const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../logger');
require('dotenv').config();

const execAsync = promisify(exec);

class MigrationRunner {
    constructor() {
        this.setupDatabaseUrl();
    }

    setupDatabaseUrl() {
        // Ensure DATABASE_URL is set for node-pg-migrate
        if (!process.env.DATABASE_URL) {
            if (process.env.DB_HOST) {
                const dbUrl = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`;
                process.env.DATABASE_URL = dbUrl;
                logger.info('DATABASE_URL constructed from individual DB environment variables');
            } else {
                throw new Error('DATABASE_URL or individual DB environment variables must be set');
            }
        }
    }

    async runMigrations(direction = 'up') {
        try {
            logger.info(`Running database migrations: ${direction}`);

            const command = direction === 'up' ? 'npm run migrate:up' : 'npm run migrate:down';
            const { stdout, stderr } = await execAsync(command, {
                cwd: process.cwd(),
                env: { ...process.env }
            });

            if (stdout) {
                logger.info('Migration output:', { output: stdout });
            }

            if (stderr) {
                logger.warn('Migration warnings:', { warnings: stderr });
            }

            logger.info(`Database migrations completed: ${direction}`);
            return { success: true, output: stdout };
        } catch (error) {
            logger.error('Migration failed', {
                error: error.message,
                stderr: error.stderr,
                stdout: error.stdout
            });
            throw error;
        }
    }

    async createMigration(name) {
        try {
            logger.info(`Creating new migration: ${name}`);

            const command = `npm run migrate:create ${name}`;
            const { stdout, stderr } = await execAsync(command, {
                cwd: process.cwd(),
                env: { ...process.env }
            });

            if (stdout) {
                logger.info('Migration creation output:', { output: stdout });
            }

            if (stderr) {
                logger.warn('Migration creation warnings:', { warnings: stderr });
            }

            logger.info(`Migration created successfully: ${name}`);
            return { success: true, output: stdout };
        } catch (error) {
            logger.error('Migration creation failed', {
                error: error.message,
                stderr: error.stderr,
                stdout: error.stdout
            });
            throw error;
        }
    }

    async getMigrationStatus() {
        try {
            const command = 'npm run migrate -- --dry-run';
            const { stdout, stderr } = await execAsync(command, {
                cwd: process.cwd(),
                env: { ...process.env }
            });

            return {
                success: true,
                status: stdout,
                warnings: stderr
            };
        } catch (error) {
            logger.error('Failed to get migration status', { error: error.message });
            throw error;
        }
    }

    async waitForDatabase(maxAttempts = 30, delayMs = 2000) {
        const { Pool } = require('pg');

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            connectionTimeoutMillis: 5000
        });

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                logger.info(`Waiting for database connection (attempt ${attempt}/${maxAttempts})`);

                const client = await pool.connect();
                await client.query('SELECT 1');
                client.release();

                logger.info('Database connection established');
                await pool.end();
                return true;
            } catch (error) {
                logger.warn(`Database connection attempt ${attempt} failed: ${error.message}`);

                if (attempt === maxAttempts) {
                    await pool.end();
                    throw new Error(`Failed to connect to database after ${maxAttempts} attempts`);
                }

                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
}

// CLI interface
if (require.main === module) {
    const runner = new MigrationRunner();
    const command = process.argv[2];
    const arg = process.argv[3];

    (async () => {
        try {
            switch (command) {
                case 'up':
                    await runner.waitForDatabase();
                    await runner.runMigrations('up');
                    console.log('✅ Migrations completed successfully');
                    break;

                case 'down':
                    await runner.waitForDatabase();
                    await runner.runMigrations('down');
                    console.log('✅ Migrations rolled back successfully');
                    break;

                case 'create':
                    if (!arg) {
                        throw new Error('Migration name is required');
                    }
                    await runner.createMigration(arg);
                    console.log(`✅ Migration '${arg}' created successfully`);
                    break;

                case 'status':
                    await runner.waitForDatabase();
                    const status = await runner.getMigrationStatus();
                    console.log('Migration Status:');
                    console.log(status.status);
                    break;

                case 'wait':
                    await runner.waitForDatabase();
                    console.log('✅ Database is ready');
                    break;

                default:
                    console.log('Usage: node migrate.js [up|down|create <name>|status|wait]');
                    console.log('  up     - Run pending migrations');
                    console.log('  down   - Rollback last migration');
                    console.log('  create - Create new migration file');
                    console.log('  status - Show migration status');
                    console.log('  wait   - Wait for database to be ready');
                    process.exit(1);
            }

            process.exit(0);
        } catch (error) {
            console.error('❌ Migration command failed:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = MigrationRunner;