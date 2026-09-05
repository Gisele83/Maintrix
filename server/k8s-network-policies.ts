// =================================================================
// KUBERNETES NETWORK POLICIES POUR ISOLATION MULTI-TENANT
// =================================================================
// Objectif 5: NetworkPolicies K8s pour cloisonnement réseau entre tenants

export interface NetworkPolicySpec {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    labels: {
      'app.kubernetes.io/name': string;
      'app.kubernetes.io/component': string;
      'smartgmao.io/tenant': string;
    };
  };
  spec: {
    podSelector: any;
    policyTypes: string[];
    ingress?: any[];
    egress?: any[];
  };
}

export class K8sNetworkPolicyService {
  
  /**
   * Générer NetworkPolicy pour isolation complète d'un tenant
   */
  static generateTenantIsolationPolicy(tenantId: string): NetworkPolicySpec {
    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: `tenant-${tenantId}-isolation`,
        namespace: 'smartgmao',
        labels: {
          'app.kubernetes.io/name': 'smartgmao-diagfix',
          'app.kubernetes.io/component': 'network-policy',
          'smartgmao.io/tenant': tenantId
        }
      },
      spec: {
        podSelector: {
          matchLabels: {
            'smartgmao.io/tenant': tenantId
          }
        },
        policyTypes: ['Ingress', 'Egress'],
        ingress: [
          // Autoriser trafic depuis le LoadBalancer/Ingress
          {
            from: [
              {
                namespaceSelector: {
                  matchLabels: {
                    'name': 'ingress-nginx'
                  }
                }
              },
              // Autoriser trafic entre pods du même tenant uniquement
              {
                podSelector: {
                  matchLabels: {
                    'smartgmao.io/tenant': tenantId
                  }
                }
              }
            ],
            ports: [
              {
                protocol: 'TCP',
                port: 5000 // Port application
              },
              {
                protocol: 'TCP', 
                port: 8080 // Port metrics
              }
            ]
          },
          // Autoriser monitoring/healthchecks
          {
            from: [
              {
                namespaceSelector: {
                  matchLabels: {
                    'name': 'monitoring'
                  }
                }
              }
            ],
            ports: [
              {
                protocol: 'TCP',
                port: 8080
              }
            ]
          }
        ],
        egress: [
          // Autoriser connexions PostgreSQL (même tenant seulement)
          {
            to: [
              {
                podSelector: {
                  matchLabels: {
                    'app': 'postgresql',
                    'smartgmao.io/tenant': tenantId
                  }
                }
              }
            ],
            ports: [
              {
                protocol: 'TCP',
                port: 5432
              }
            ]
          },
          // Autoriser S3/MinIO (compartimenté)
          {
            to: [
              {
                podSelector: {
                  matchLabels: {
                    'app': 'minio'
                  }
                }
              }
            ],
            ports: [
              {
                protocol: 'TCP',
                port: 9000
              }
            ]
          },
          // Autoriser DNS
          {
            to: [],
            ports: [
              {
                protocol: 'UDP',
                port: 53
              },
              {
                protocol: 'TCP',
                port: 53
              }
            ]
          },
          // Autoriser HTTPS vers APIs externes (KMS, OIDC)
          {
            to: [],
            ports: [
              {
                protocol: 'TCP',
                port: 443
              }
            ]
          }
        ]
      }
    };
  }
  
  /**
   * Générer NetworkPolicy pour base de données par tenant
   */
  static generateTenantDatabasePolicy(tenantId: string): NetworkPolicySpec {
    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy', 
      metadata: {
        name: `tenant-${tenantId}-database`,
        namespace: 'smartgmao',
        labels: {
          'app.kubernetes.io/name': 'postgresql',
          'app.kubernetes.io/component': 'network-policy',
          'smartgmao.io/tenant': tenantId
        }
      },
      spec: {
        podSelector: {
          matchLabels: {
            'app': 'postgresql',
            'smartgmao.io/tenant': tenantId
          }
        },
        policyTypes: ['Ingress'],
        ingress: [
          // Seules les applications du même tenant peuvent accéder à la DB
          {
            from: [
              {
                podSelector: {
                  matchLabels: {
                    'smartgmao.io/tenant': tenantId,
                    'app.kubernetes.io/name': 'smartgmao-diagfix'
                  }
                }
              }
            ],
            ports: [
              {
                protocol: 'TCP',
                port: 5432
              }
            ]
          },
          // Autoriser backup/monitoring
          {
            from: [
              {
                namespaceSelector: {
                  matchLabels: {
                    'name': 'backup'
                  }
                }
              },
              {
                namespaceSelector: {
                  matchLabels: {
                    'name': 'monitoring'
                  }
                }
              }
            ],
            ports: [
              {
                protocol: 'TCP',
                port: 5432
              }
            ]
          }
        ]
      }
    };
  }
  
  /**
   * Générer NetworkPolicy par défaut pour refus total
   */
  static generateDefaultDenyPolicy(): NetworkPolicySpec {
    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: 'default-deny-all',
        namespace: 'smartgmao',
        labels: {
          'app.kubernetes.io/name': 'smartgmao-diagfix',
          'app.kubernetes.io/component': 'network-policy',
          'smartgmao.io/tenant': 'system'
        }
      },
      spec: {
        podSelector: {}, // Sélectionne tous les pods
        policyTypes: ['Ingress', 'Egress']
        // Pas de règles ingress/egress = refus complet
      }
    };
  }
  
  /**
   * Générer toutes les policies pour un nouveau tenant
   */
  static generateAllTenantPolicies(tenantId: string): NetworkPolicySpec[] {
    return [
      this.generateTenantIsolationPolicy(tenantId),
      this.generateTenantDatabasePolicy(tenantId),
    ];
  }
  
  /**
   * Générer manifestes YAML Kubernetes
   */
  static generateYamlManifests(tenantId: string): string {
    const policies = this.generateAllTenantPolicies(tenantId);
    const defaultDenyPolicy = this.generateDefaultDenyPolicy();
    
    const allPolicies = [...policies, defaultDenyPolicy];
    
    return allPolicies.map(policy => {
      return `---
# NetworkPolicy pour isolation tenant: ${tenantId}
${JSON.stringify(policy, null, 2).replace(/"/g, '')}`;
    }).join('\n\n');
  }
  
  /**
   * Valider configuration NetworkPolicy
   */
  static validateNetworkPolicyConfig(policy: NetworkPolicySpec): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validation des champs obligatoires
    if (!policy.metadata?.name) {
      errors.push('NetworkPolicy name is required');
    }
    
    if (!policy.metadata?.namespace) {
      errors.push('NetworkPolicy namespace is required');
    }
    
    if (!policy.metadata?.labels?.['smartgmao.io/tenant']) {
      errors.push('Tenant label is required for isolation');
    }
    
    // Validation des règles de sécurité
    if (!policy.spec.policyTypes || policy.spec.policyTypes.length === 0) {
      errors.push('PolicyTypes must be specified');
    }
    
    // Vérifier isolation tenant
    const tenantId = policy.metadata.labels?.['smartgmao.io/tenant'];
    if (tenantId && tenantId !== 'system') {
      // Vérifier que les règles ingress ne permettent pas d'accès croisé
      if (policy.spec.ingress) {
        for (const rule of policy.spec.ingress) {
          if (rule.from) {
            for (const source of rule.from) {
              if (source.podSelector && !source.podSelector.matchLabels?.['smartgmao.io/tenant']) {
                warnings.push('Ingress rule may allow cross-tenant access');
              }
            }
          }
        }
      }
    }
    
    // Vérifier que les ports essentiels sont ouverts
    const hasHealthPort = policy.spec.ingress?.some(rule =>
      rule.ports?.some((port: any) => port.port === 8080)
    );
    
    if (!hasHealthPort) {
      warnings.push('Health check port (8080) should be accessible for monitoring');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Générer script de déploiement Kubernetes
   */
  static generateDeploymentScript(tenantId: string): string {
    return `#!/bin/bash
# Script de déploiement NetworkPolicies pour tenant: ${tenantId}

set -e

TENANT_ID="${tenantId}"
NAMESPACE="smartgmao"

echo "🔒 Deploying NetworkPolicies for tenant: \$TENANT_ID"

# Créer namespace si nécessaire
kubectl create namespace \$NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Labeller namespace pour identification
kubectl label namespace \$NAMESPACE smartgmao.io/tenant=\$TENANT_ID --overwrite

# Déployer NetworkPolicies
cat <<EOF | kubectl apply -f -
${this.generateYamlManifests(tenantId)}
EOF

echo "✅ NetworkPolicies deployed successfully"

# Vérifier déploiement
echo "🔍 Verifying NetworkPolicies..."
kubectl get networkpolicies -n \$NAMESPACE -l smartgmao.io/tenant=\$TENANT_ID

echo "🔐 Network isolation active for tenant: \$TENANT_ID"
`;
  }
  
  /**
   * Tests de connectivité pour valider l'isolation
   */
  static generateConnectivityTests(tenantId: string): string {
    return `#!/bin/bash
# Tests de connectivité pour vérifier isolation tenant: ${tenantId}

TENANT_ID="${tenantId}"
NAMESPACE="smartgmao"

echo "🧪 Testing network isolation for tenant: \$TENANT_ID"

# Test 1: Vérifier accès intra-tenant (doit réussir)
echo "Test 1: Intra-tenant connectivity"
kubectl run test-pod-\$TENANT_ID \\
  --image=busybox \\
  --labels="smartgmao.io/tenant=\$TENANT_ID" \\
  --rm -i --restart=Never \\
  --namespace=\$NAMESPACE \\
  -- wget -q --timeout=5 -O- http://smartgmao-app-\$TENANT_ID:5000/health

# Test 2: Vérifier isolation cross-tenant (doit échouer)
echo "Test 2: Cross-tenant isolation"
OTHER_TENANT="other-tenant-test"
kubectl run test-isolation-\$TENANT_ID \\
  --image=busybox \\
  --labels="smartgmao.io/tenant=\$TENANT_ID" \\
  --rm -i --restart=Never \\
  --namespace=\$NAMESPACE \\
  -- timeout 10 wget -q -O- http://smartgmao-app-\$OTHER_TENANT:5000/health || echo "✅ Cross-tenant access blocked (expected)"

# Test 3: Vérifier accès base de données
echo "Test 3: Database connectivity"
kubectl run test-db-\$TENANT_ID \\
  --image=postgres:13 \\
  --labels="smartgmao.io/tenant=\$TENANT_ID" \\
  --rm -i --restart=Never \\
  --namespace=\$NAMESPACE \\
  -- pg_isready -h postgresql-\$TENANT_ID -p 5432

echo "🔒 Network isolation tests completed for tenant: \$TENANT_ID"
`;
  }
}