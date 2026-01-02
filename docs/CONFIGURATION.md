# Configuration Reference

## Table of Contents
1. [Environment Variables](#environment-variables)
2. [Terraform Variables](#terraform-variables)
3. [Kubernetes Configuration](#kubernetes-configuration)
4. [Application Configuration](#application-configuration)
5. [Monitoring Configuration](#monitoring-configuration)
6. [Security Configuration](#security-configuration)

## Environment Variables

### Backend Application Variables

#### Database Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL database hostname | `localhost` | Yes |
| `DB_PORT` | PostgreSQL database port | `5432` | Yes |
| `DB_NAME` | Database name | `dhakacart` | Yes |
| `DB_USER` | Database username | `postgres` | Yes |
| `DB_PASSWORD` | Database password | - | Yes |
| `DB_SSL` | Enable SSL for database connection | `false` | No |
| `DB_POOL_MIN` | Minimum connection pool size | `2` | No |
| `DB_POOL_MAX` | Maximum connection pool size | `20` | No |
| `DB_POOL_IDLE_TIMEOUT` | Connection idle timeout (ms) | `30000` | No |

#### Redis Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_HOST` | Redis hostname | `localhost` | Yes |
| `REDIS_PORT` | Redis port | `6379` | Yes |
| `REDIS_PASSWORD` | Redis password | - | No |
| `REDIS_DB` | Redis database number | `0` | No |
| `REDIS_TLS` | Enable TLS for Redis connection | `false` | No |
| `REDIS_CLUSTER_MODE` | Enable Redis cluster mode | `false` | No |

#### Application Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Node.js environment | `development` | Yes |
| `PORT` | Application port | `5000` | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `JWT_EXPIRES_IN` | JWT token expiration | `24h` | No |
| `API_RATE_LIMIT` | Rate limit per IP per minute | `100` | No |
| `CORS_ORIGIN` | CORS allowed origins | `*` | No |
| `BODY_LIMIT` | Request body size limit | `10mb` | No |

#### Logging Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | `info` | No |
| `LOG_FORMAT` | Log format (json, simple) | `json` | No |
| `LOG_FILE` | Log file path | - | No |
| `LOG_MAX_SIZE` | Maximum log file size | `10m` | No |
| `LOG_MAX_FILES` | Maximum number of log files | `5` | No |

#### Monitoring Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `METRICS_ENABLED` | Enable Prometheus metrics | `true` | No |
| `METRICS_PORT` | Metrics endpoint port | `9090` | No |
| `HEALTH_CHECK_TIMEOUT` | Health check timeout (ms) | `5000` | No |
| `TRACING_ENABLED` | Enable distributed tracing | `false` | No |
| `TRACING_ENDPOINT` | Jaeger tracing endpoint | - | No |

### Frontend Application Variables

#### API Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REACT_APP_API_URL` | Backend API URL | `http://localhost:5000` | Yes |
| `REACT_APP_API_TIMEOUT` | API request timeout (ms) | `10000` | No |
| `REACT_APP_API_RETRY_ATTEMPTS` | API retry attempts | `3` | No |

#### Application Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REACT_APP_ENVIRONMENT` | Application environment | `development` | Yes |
| `REACT_APP_VERSION` | Application version | - | No |
| `REACT_APP_BUILD_DATE` | Build timestamp | - | No |

#### Feature Flags
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REACT_APP_ENABLE_ANALYTICS` | Enable analytics tracking | `false` | No |
| `REACT_APP_ENABLE_ERROR_REPORTING` | Enable error reporting | `false` | No |
| `REACT_APP_ENABLE_PERFORMANCE_MONITORING` | Enable performance monitoring | `false` | No |

#### Analytics Configuration
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REACT_APP_GA_TRACKING_ID` | Google Analytics tracking ID | - | No |
| `REACT_APP_SENTRY_DSN` | Sentry error reporting DSN | - | No |

## Terraform Variables

### Basic Configuration
```hcl
# terraform.tfvars
region = "us-west-2"
environment = "production"
project_name = "dhakacart"
```

### EKS Cluster Configuration
```hcl
# EKS Cluster
cluster_name = "dhakacart-cluster"
cluster_version = "1.28"
cluster_endpoint_private_access = true
cluster_endpoint_public_access = true
cluster_endpoint_public_access_cidrs = ["0.0.0.0/0"]

# Node Groups
node_groups = {
  main = {
    instance_types = ["t3.medium"]
    capacity_type = "ON_DEMAND"
    min_capacity = 2
    max_capacity = 10
    desired_capacity = 3
    disk_size = 50
    ami_type = "AL2_x86_64"
  }
  spot = {
    instance_types = ["t3.medium", "t3a.medium"]
    capacity_type = "SPOT"
    min_capacity = 0
    max_capacity = 5
    desired_capacity = 1
    disk_size = 50
    ami_type = "AL2_x86_64"
  }
}

# Add-ons
cluster_addons = {
  coredns = {
    most_recent = true
  }
  kube-proxy = {
    most_recent = true
  }
  vpc-cni = {
    most_recent = true
  }
  aws-ebs-csi-driver = {
    most_recent = true
  }
}
```

### Database Configuration
```hcl
# RDS PostgreSQL
db_instance_class = "db.t3.micro"
db_allocated_storage = 20
db_max_allocated_storage = 100
db_storage_type = "gp3"
db_storage_encrypted = true
db_backup_retention_period = 7
db_backup_window = "03:00-04:00"
db_maintenance_window = "sun:04:00-sun:05:00"
db_multi_az = true
db_deletion_protection = true
db_skip_final_snapshot = false
db_final_snapshot_identifier = "dhakacart-final-snapshot"

# Database parameters
db_parameters = [
  {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  },
  {
    name  = "log_statement"
    value = "all"
  },
  {
    name  = "log_min_duration_statement"
    value = "1000"
  }
]
```

### Redis Configuration
```hcl
# ElastiCache Redis
redis_node_type = "cache.t3.micro"
redis_num_cache_nodes = 2
redis_parameter_group_name = "default.redis7"
redis_port = 6379
redis_maintenance_window = "sun:05:00-sun:06:00"
redis_snapshot_retention_limit = 7
redis_snapshot_window = "03:00-05:00"
redis_at_rest_encryption_enabled = true
redis_transit_encryption_enabled = true
redis_auth_token_enabled = true
```

### Networking Configuration
```hcl
# VPC Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = ["us-west-2a", "us-west-2b", "us-west-2c"]

# Subnet Configuration
public_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
private_subnets = ["10.0.10.0/24", "10.0.20.0/24", "10.0.30.0/24"]
database_subnets = ["10.0.100.0/24", "10.0.200.0/24", "10.0.300.0/24"]

# NAT Gateway
enable_nat_gateway = true
single_nat_gateway = false
one_nat_gateway_per_az = true

# DNS
enable_dns_hostnames = true
enable_dns_support = true
```

### Security Configuration
```hcl
# IAM and RBAC
enable_irsa = true
create_aws_auth_configmap = true
manage_aws_auth_configmap = true

# Security Groups
additional_security_group_ids = []
cluster_security_group_additional_rules = {
  ingress_nodes_443 = {
    description = "Node groups to cluster API"
    protocol = "tcp"
    from_port = 443
    to_port = 443
    type = "ingress"
    source_node_security_group = true
  }
}

# Encryption
cluster_encryption_config = [
  {
    provider_key_arn = "alias/eks-cluster-key"
    resources = ["secrets"]
  }
]
```

## Kubernetes Configuration

### Resource Limits and Requests
```yaml
# Backend Deployment
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"

# Frontend Deployment
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"
```

### Auto-scaling Configuration
```yaml
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: dhakacart-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: dhakacart-backend
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

### Health Check Configuration
```yaml
# Liveness Probe
livenessProbe:
  httpGet:
    path: /health
    port: 5000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
  successThreshold: 1

# Readiness Probe
readinessProbe:
  httpGet:
    path: /ready
    port: 5000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
  successThreshold: 1

# Startup Probe
startupProbe:
  httpGet:
    path: /health
    port: 5000
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 30
  successThreshold: 1
```

## Application Configuration

### Database Connection Pool
```javascript
// backend/config/database.js
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  
  // Connection pool settings
  min: parseInt(process.env.DB_POOL_MIN) || 2,
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: 2000,
  
  // Query settings
  statement_timeout: 30000,
  query_timeout: 30000,
  
  // Application name for monitoring
  application_name: 'dhakacart-backend'
});
```

### Redis Configuration
```javascript
// backend/config/redis.js
const redis = require('redis');

const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB) || 0,
  
  // Connection settings
  connect_timeout: 60000,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  
  // TLS settings
  tls: process.env.REDIS_TLS === 'true' ? {} : null,
  
  // Cluster settings (if using Redis Cluster)
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
});
```

### Rate Limiting Configuration
```javascript
// backend/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

const limiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.API_RATE_LIMIT) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  // Skip successful requests
  skipSuccessfulRequests: false,
  
  // Skip failed requests
  skipFailedRequests: false,
  
  // Custom key generator
  keyGenerator: (req) => {
    return req.ip + ':' + req.path;
  }
});
```

## Monitoring Configuration

### Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'kubernetes-apiservers'
    kubernetes_sd_configs:
    - role: endpoints
    scheme: https
    tls_config:
      ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
    relabel_configs:
    - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
      action: keep
      regex: default;kubernetes;https

  - job_name: 'kubernetes-nodes'
    kubernetes_sd_configs:
    - role: node
    scheme: https
    tls_config:
      ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
    relabel_configs:
    - action: labelmap
      regex: __meta_kubernetes_node_label_(.+)

  - job_name: 'dhakacart-backend'
    kubernetes_sd_configs:
    - role: endpoints
    relabel_configs:
    - source_labels: [__meta_kubernetes_service_name]
      action: keep
      regex: dhakacart-backend
    - source_labels: [__meta_kubernetes_endpoint_port_name]
      action: keep
      regex: metrics
```

### Grafana Dashboard Configuration
```json
{
  "dashboard": {
    "title": "DhakaCart Application Metrics",
    "tags": ["dhakacart", "application"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\"dhakacart-backend\"}[5m])",
            "legendFormat": "{{method}} {{status_code}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=\"dhakacart-backend\"}[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      }
    ]
  }
}
```

### AlertManager Configuration
```yaml
# alertmanager.yml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@dhakacart.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'
  routes:
  - match:
      severity: critical
    receiver: 'critical-alerts'
  - match:
      severity: warning
    receiver: 'warning-alerts'

receivers:
- name: 'web.hook'
  webhook_configs:
  - url: 'http://127.0.0.1:5001/'

- name: 'critical-alerts'
  email_configs:
  - to: 'oncall@dhakacart.com'
    subject: 'CRITICAL: {{ .GroupLabels.alertname }}'
    body: |
      {{ range .Alerts }}
      Alert: {{ .Annotations.summary }}
      Description: {{ .Annotations.description }}
      {{ end }}
  slack_configs:
  - api_url: 'YOUR_SLACK_WEBHOOK_URL'
    channel: '#alerts-critical'
    title: 'CRITICAL Alert'
    text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'

- name: 'warning-alerts'
  email_configs:
  - to: 'team@dhakacart.com'
    subject: 'WARNING: {{ .GroupLabels.alertname }}'
```

## Security Configuration

### Network Policies
```yaml
# Network policy for backend pods
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: dhakacart-backend-netpol
  namespace: dhakacart
spec:
  podSelector:
    matchLabels:
      app: dhakacart-backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: dhakacart-frontend
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 5000
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 5432  # PostgreSQL
    - protocol: TCP
      port: 6379  # Redis
    - protocol: TCP
      port: 443   # HTTPS
    - protocol: TCP
      port: 53    # DNS
    - protocol: UDP
      port: 53    # DNS
```

### Pod Security Policy
```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: dhakacart-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

### RBAC Configuration
```yaml
# Service Account
apiVersion: v1
kind: ServiceAccount
metadata:
  name: dhakacart-backend
  namespace: dhakacart

---
# Role
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: dhakacart
  name: dhakacart-backend-role
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]

---
# RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: dhakacart-backend-binding
  namespace: dhakacart
subjects:
- kind: ServiceAccount
  name: dhakacart-backend
  namespace: dhakacart
roleRef:
  kind: Role
  name: dhakacart-backend-role
  apiGroup: rbac.authorization.k8s.io
```

This configuration reference provides comprehensive documentation for all configurable aspects of the DhakaCart platform, enabling teams to customize the deployment according to their specific requirements and environments.