# Task 11.3: Validate Load Balancing and Auto-scaling

## Overview

This guide provides comprehensive instructions for configuring and validating load balancing with AWS Application Load Balancer (ALB) and auto-scaling with Horizontal Pod Autoscaler (HPA) and Cluster Autoscaler. The setup ensures the DhakaCart application can handle varying loads automatically while maintaining performance requirements.

## Prerequisites

Before configuring load balancing and auto-scaling, ensure you have:

1. **Infrastructure deployed** (Task 11.1 completed)
2. **Applications deployed** (Task 11.2 completed)
3. **kubectl** configured for your EKS cluster
4. **AWS Load Balancer Controller** permissions configured
5. **Metrics Server** installed in the cluster

## Architecture Overview

### Load Balancing Components
- **AWS Application Load Balancer (ALB)**: Internet-facing load balancer
- **AWS Load Balancer Controller**: Kubernetes controller for ALB management
- **Ingress Resources**: Kubernetes ingress definitions
- **Services**: ClusterIP services for internal load balancing

### Auto-scaling Components
- **Horizontal Pod Autoscaler (HPA)**: Scales pods based on CPU/memory metrics
- **Cluster Autoscaler**: Scales worker nodes based on pod resource requirements
- **Metrics Server**: Provides resource metrics for scaling decisions

## Implementation Steps

### Step 1: Install AWS Load Balancer Controller

#### Prerequisites for Load Balancer Controller

1. **Create IAM Policy** (if not done via Terraform):
   ```bash
   curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.2/docs/install/iam_policy.json
   
   aws iam create-policy \
     --policy-name AWSLoadBalancerControllerIAMPolicy \
     --policy-document file://iam_policy.json
   ```

2. **Create Service Account with IAM Role**:
   ```bash
   eksctl create iamserviceaccount \
     --cluster=dhakacart-cluster \
     --namespace=kube-system \
     --name=aws-load-balancer-controller \
     --role-name AmazonEKSLoadBalancerControllerRole \
     --attach-policy-arn=arn:aws:iam::ACCOUNT_ID:policy/AWSLoadBalancerControllerIAMPolicy \
     --approve
   ```

#### Install Controller via Helm

1. **Add Helm repository**:
   ```bash
   helm repo add eks https://aws.github.io/eks-charts
   helm repo update
   ```

2. **Install AWS Load Balancer Controller**:
   ```bash
   helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
     -n kube-system \
     --set clusterName=dhakacart-cluster \
     --set serviceAccount.create=false \
     --set serviceAccount.name=aws-load-balancer-controller
   ```

3. **Verify installation**:
   ```bash
   kubectl get deployment -n kube-system aws-load-balancer-controller
   kubectl logs -n kube-system deployment/aws-load-balancer-controller
   ```

### Step 2: Configure Ingress for Load Balancing

#### Create Basic Ingress Configuration

1. **Create ingress manifest** (`ingress-basic.yaml`):
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: dhakacart-ingress
     namespace: dhakacart
     annotations:
       kubernetes.io/ingress.class: alb
       alb.ingress.kubernetes.io/scheme: internet-facing
       alb.ingress.kubernetes.io/target-type: ip
       alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}]'
       alb.ingress.kubernetes.io/load-balancer-name: dhakacart-alb
       alb.ingress.kubernetes.io/healthcheck-path: /health
       alb.ingress.kubernetes.io/healthcheck-interval-seconds: '30'
       alb.ingress.kubernetes.io/healthcheck-timeout-seconds: '5'
       alb.ingress.kubernetes.io/healthy-threshold-count: '2'
       alb.ingress.kubernetes.io/unhealthy-threshold-count: '3'
   spec:
     ingressClassName: alb
     rules:
     - http:
         paths:
         - path: /api
           pathType: Prefix
           backend:
             service:
               name: dhakacart-backend-service
               port:
                 number: 5000
         - path: /
           pathType: Prefix
           backend:
             service:
               name: dhakacart-frontend-service
               port:
                 number: 80
   ```

2. **Apply ingress configuration**:
   ```bash
   kubectl apply -f ingress-basic.yaml
   ```

3. **Wait for load balancer provisioning**:
   ```bash
   kubectl get ingress dhakacart-ingress -n dhakacart -w
   ```

4. **Get load balancer URL**:
   ```bash
   ALB_URL=$(kubectl get ingress dhakacart-ingress -n dhakacart -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
   echo "Load Balancer URL: http://$ALB_URL"
   ```

#### Configure SSL/TLS (Production)

1. **Request ACM certificate**:
   ```bash
   aws acm request-certificate \
     --domain-name dhakacart.com \
     --subject-alternative-names www.dhakacart.com api.dhakacart.com \
     --validation-method DNS \
     --region us-west-2
   ```

2. **Update ingress with SSL** (`ingress-ssl.yaml`):
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: dhakacart-ingress-ssl
     namespace: dhakacart
     annotations:
       kubernetes.io/ingress.class: alb
       alb.ingress.kubernetes.io/scheme: internet-facing
       alb.ingress.kubernetes.io/target-type: ip
       alb.ingress.kubernetes.io/certificate-arn: "arn:aws:acm:us-west-2:ACCOUNT_ID:certificate/CERT_ID"
       alb.ingress.kubernetes.io/ssl-policy: ELBSecurityPolicy-TLS-1-2-2017-01
       alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
       alb.ingress.kubernetes.io/ssl-redirect: '443'
   spec:
     ingressClassName: alb
     rules:
     - host: dhakacart.com
       http:
         paths:
         - path: /api
           pathType: Prefix
           backend:
             service:
               name: dhakacart-backend-service
               port:
                 number: 5000
         - path: /
           pathType: Prefix
           backend:
             service:
               name: dhakacart-frontend-service
               port:
                 number: 80
   ```

### Step 3: Configure Horizontal Pod Autoscaler (HPA)

#### Install Metrics Server (if not present)

1. **Check if Metrics Server is installed**:
   ```bash
   kubectl get deployment metrics-server -n kube-system
   ```

2. **Install Metrics Server if needed**:
   ```bash
   kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
   ```

#### Deploy HPA for Backend

1. **Create backend HPA** (`backend-hpa.yaml`):
   ```yaml
   apiVersion: autoscaling/v2
   kind: HorizontalPodAutoscaler
   metadata:
     name: dhakacart-backend-hpa
     namespace: dhakacart
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
           value: 100
           periodSeconds: 60
   ```

2. **Apply backend HPA**:
   ```bash
   kubectl apply -f backend-hpa.yaml
   ```

#### Deploy HPA for Frontend

1. **Create frontend HPA** (`frontend-hpa.yaml`):
   ```yaml
   apiVersion: autoscaling/v2
   kind: HorizontalPodAutoscaler
   metadata:
     name: dhakacart-frontend-hpa
     namespace: dhakacart
   spec:
     scaleTargetRef:
       apiVersion: apps/v1
       kind: Deployment
       name: dhakacart-frontend
     minReplicas: 3
     maxReplicas: 20
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
   ```

2. **Apply frontend HPA**:
   ```bash
   kubectl apply -f frontend-hpa.yaml
   ```

#### Verify HPA Configuration

1. **Check HPA status**:
   ```bash
   kubectl get hpa -n dhakacart
   kubectl describe hpa dhakacart-backend-hpa -n dhakacart
   kubectl describe hpa dhakacart-frontend-hpa -n dhakacart
   ```

### Step 4: Configure Cluster Autoscaler

#### Create Cluster Autoscaler

1. **Apply Cluster Autoscaler manifest**:
   ```bash
   kubectl apply -f kubernetes/autoscaling/cluster-autoscaler.yaml
   ```

2. **Verify Cluster Autoscaler deployment**:
   ```bash
   kubectl get deployment cluster-autoscaler -n kube-system
   kubectl logs -f deployment/cluster-autoscaler -n kube-system
   ```

#### Configure Node Group Auto Scaling

1. **Update EKS node group tags** (if not done via Terraform):
   ```bash
   aws eks describe-nodegroup --cluster-name dhakacart-cluster --nodegroup-name dhakacart-nodes
   
   # Ensure these tags are present:
   # k8s.io/cluster-autoscaler/enabled: true
   # k8s.io/cluster-autoscaler/dhakacart-cluster: owned
   ```

### Step 5: Test Load Balancer Functionality

#### Basic Connectivity Tests

1. **Test frontend access**:
   ```bash
   curl -I http://$ALB_URL/
   ```

2. **Test backend API access**:
   ```bash
   curl -I http://$ALB_URL/api/health
   ```

3. **Test load distribution**:
   ```bash
   # Run multiple requests and check different pod responses
   for i in {1..10}; do
     curl -s http://$ALB_URL/api/health | jq .hostname
   done
   ```

#### Health Check Validation

1. **Check ALB target group health**:
   ```bash
   # Get target group ARN from AWS console or CLI
   aws elbv2 describe-target-health --target-group-arn TARGET_GROUP_ARN
   ```

2. **Verify health check configuration**:
   ```bash
   kubectl describe ingress dhakacart-ingress -n dhakacart
   ```

### Step 6: Test Auto-scaling Behavior

#### Generate Load for HPA Testing

1. **Create load test pod**:
   ```yaml
   apiVersion: v1
   kind: Pod
   metadata:
     name: load-test
     namespace: dhakacart
   spec:
     containers:
     - name: load-test
       image: busybox
       command:
       - /bin/sh
       - -c
       - |
         while true; do
           wget -q -O- http://dhakacart-backend-service:5000/api/products
           wget -q -O- http://dhakacart-frontend-service/
         done
   ```

2. **Apply load test**:
   ```bash
   kubectl apply -f load-test.yaml
   ```

3. **Monitor HPA scaling**:
   ```bash
   kubectl get hpa -n dhakacart -w
   ```

4. **Watch pod scaling**:
   ```bash
   kubectl get pods -n dhakacart -w
   ```

#### Generate Load for Cluster Autoscaler Testing

1. **Create resource-intensive deployment**:
   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: resource-consumer
     namespace: dhakacart
   spec:
     replicas: 10
     selector:
       matchLabels:
         app: resource-consumer
     template:
       metadata:
         labels:
           app: resource-consumer
       spec:
         containers:
         - name: consumer
           image: nginx
           resources:
             requests:
               cpu: 1000m
               memory: 1Gi
   ```

2. **Apply resource consumer**:
   ```bash
   kubectl apply -f resource-consumer.yaml
   ```

3. **Monitor cluster scaling**:
   ```bash
   kubectl get nodes -w
   kubectl logs -f deployment/cluster-autoscaler -n kube-system
   ```

### Step 7: Performance and Load Testing

#### Install Artillery for Load Testing

1. **Install Artillery** (if not already installed):
   ```bash
   npm install -g artillery
   ```

2. **Create load test configuration** (`load-test.yml`):
   ```yaml
   config:
     target: 'http://YOUR_ALB_URL'
     phases:
       - duration: 300
         arrivalRate: 10
         rampTo: 100
   scenarios:
     - name: "API Load Test"
       flow:
         - get:
             url: "/api/health"
         - get:
             url: "/api/products"
         - get:
             url: "/"
   ```

3. **Run load test**:
   ```bash
   artillery run load-test.yml
   ```

#### Monitor During Load Test

1. **Monitor HPA metrics**:
   ```bash
   kubectl top pods -n dhakacart
   kubectl get hpa -n dhakacart
   ```

2. **Monitor node utilization**:
   ```bash
   kubectl top nodes
   ```

3. **Check ALB metrics in CloudWatch**:
   - Request count
   - Response time
   - Target response time
   - Healthy/unhealthy targets

## Validation Checklist

Mark each item as complete when validated:

### Load Balancer Configuration
- [ ] AWS Load Balancer Controller installed and running
- [ ] Ingress resource created with ALB annotations
- [ ] Application Load Balancer provisioned in AWS
- [ ] Target groups created and healthy
- [ ] Health checks configured and passing
- [ ] Frontend accessible via load balancer
- [ ] Backend API accessible via load balancer
- [ ] Load distribution working across multiple pods

### SSL/TLS Configuration (Production)
- [ ] ACM certificate requested and validated
- [ ] Ingress updated with certificate ARN
- [ ] HTTPS listeners configured
- [ ] HTTP to HTTPS redirect working
- [ ] SSL policy configured appropriately

### Horizontal Pod Autoscaler
- [ ] Metrics Server installed and running
- [ ] Frontend HPA deployed and active
- [ ] Backend HPA deployed and active
- [ ] CPU metrics available for scaling decisions
- [ ] Memory metrics available for scaling decisions
- [ ] Scaling up behavior tested under load
- [ ] Scaling down behavior tested after load reduction

### Cluster Autoscaler
- [ ] Cluster Autoscaler deployed in kube-system namespace
- [ ] Node group tags configured for auto-discovery
- [ ] IAM permissions configured for node scaling
- [ ] Scale-up behavior tested with resource pressure
- [ ] Scale-down behavior tested with resource availability
- [ ] Cluster Autoscaler logs show proper operation

### Performance Validation
- [ ] Load testing performed with Artillery or similar tool
- [ ] Response times remain under 2 seconds during load (Requirement 1.1)
- [ ] Auto-scaling triggers within 5 minutes (Requirement 1.2)
- [ ] System maintains 99.9% uptime during testing (Requirement 1.5)
- [ ] Load balancer distributes traffic evenly
- [ ] No failed requests during normal scaling operations

## Expected Results

After successful configuration and validation:

### Load Balancer
- ALB provisioned with public DNS name
- Target groups showing healthy targets
- Traffic distributed across multiple pods
- Health checks passing consistently

### Auto-scaling Behavior
- HPA scales pods based on CPU/memory utilization
- Cluster Autoscaler adds nodes when pods can't be scheduled
- Scaling events logged and visible in Kubernetes events
- Applications remain available during scaling operations

### Performance Metrics
- Response times under 2 seconds for 95% of requests
- Auto-scaling triggers within defined thresholds
- No service interruption during scaling events
- Efficient resource utilization

## Troubleshooting

### Common Load Balancer Issues

1. **Ingress not getting external IP**:
   - Check AWS Load Balancer Controller logs
   - Verify IAM permissions for controller
   - Check subnet tags for auto-discovery

2. **Health checks failing**:
   - Verify health check path exists in application
   - Check security group rules
   - Verify target group configuration

3. **SSL certificate issues**:
   - Ensure certificate is in the same region as ALB
   - Verify certificate validation is complete
   - Check certificate ARN in ingress annotations

### Common Auto-scaling Issues

1. **HPA not scaling**:
   - Check Metrics Server is running
   - Verify resource requests are set on pods
   - Check HPA events: `kubectl describe hpa <name>`

2. **Cluster Autoscaler not adding nodes**:
   - Verify node group has scaling capacity
   - Check Cluster Autoscaler logs for errors
   - Ensure proper IAM permissions

3. **Slow scaling response**:
   - Adjust HPA behavior policies
   - Reduce stabilization windows for faster scaling
   - Check resource limits and requests

### Debugging Commands

1. **Check load balancer status**:
   ```bash
   kubectl describe ingress dhakacart-ingress -n dhakacart
   aws elbv2 describe-load-balancers
   aws elbv2 describe-target-groups
   ```

2. **Monitor auto-scaling**:
   ```bash
   kubectl get events -n dhakacart --sort-by='.lastTimestamp'
   kubectl logs -f deployment/cluster-autoscaler -n kube-system
   ```

3. **Check resource utilization**:
   ```bash
   kubectl top pods -n dhakacart
   kubectl top nodes
   ```

## Security Considerations

- ALB security groups restrict access to necessary ports only
- SSL/TLS encryption for all production traffic
- WAF integration for application-layer protection
- Private subnets for application pods
- IAM roles follow principle of least privilege

## Cost Optimization

- Use appropriate instance types for node groups
- Configure scale-down policies to reduce unused capacity
- Monitor CloudWatch metrics for cost optimization opportunities
- Consider Spot instances for non-critical workloads
- Set appropriate HPA min/max replicas

## Next Steps

Once load balancing and auto-scaling validation is complete:

1. Proceed to Task 11.4: Verify monitoring and alerting systems
2. Configure custom metrics for more sophisticated scaling
3. Implement blue-green deployment strategies
4. Set up disaster recovery testing
5. Validate security and compliance requirements

This completes the load balancing and auto-scaling configuration and validation for Task 11.3.