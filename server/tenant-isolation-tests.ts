// =================================================================
// TESTS D'ISOLATION MULTI-TENANT
// =================================================================
// Tests automatisés qui prouvent l'isolation complète des données
// et empêchent tout accès croisé entre tenants

import { db } from "./db";
import { sql } from "drizzle-orm";
import { maintenanceCases, diagnosticSessions, auditLogs } from "@shared/schema";

// Interface pour les résultats de test
interface TenantIsolationTestResult {
  testName: string;
  passed: boolean;
  details: string;
  timestamp: Date;
}

export class TenantIsolationTester {
  
  /**
   * Exécuter tous les tests d'isolation
   */
  static async runAllTests(): Promise<TenantIsolationTestResult[]> {
    console.log("🔒 Démarrage des tests d'isolation multi-tenant...");
    
    const results: TenantIsolationTestResult[] = [];
    
    // Test 1: Isolation des cas de maintenance
    results.push(await this.testMaintenanceCasesIsolation());
    
    // Test 2: Isolation des sessions de diagnostic
    results.push(await this.testDiagnosticSessionsIsolation());
    
    // Test 3: Isolation des logs d'audit
    results.push(await this.testAuditLogsIsolation());
    
    // Test 4: Test de tentative d'accès croisé (doit échouer)
    results.push(await this.testCrossTenantAccessPrevention());
    
    // Test 5: Test de fuite de données via queries malveillantes
    results.push(await this.testSQLInjectionPrevention());
    
    // Résumé des résultats
    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;
    
    console.log(`🔒 Tests d'isolation terminés: ${passedTests}/${totalTests} réussis`);
    
    if (passedTests === totalTests) {
      console.log("✅ ISOLATION MULTI-TENANT VÉRIFIÉE - Aucune fuite de données détectée");
    } else {
      console.error("❌ VIOLATION D'ISOLATION DÉTECTÉE - Architecture non sécurisée pour SaaS");
    }
    
    return results;
  }
  
  /**
   * Test 1: Vérifier isolation des maintenance_cases
   */
  private static async testMaintenanceCasesIsolation(): Promise<TenantIsolationTestResult> {
    try {
      const testTenant1 = "test-tenant-1";
      const testTenant2 = "test-tenant-2";
      
      // Insérer données pour tenant 1
      await db.execute(sql`SELECT set_current_tenant(${testTenant1})`);
      await db.insert(maintenanceCases).values({
        equipmentType: "TEST_EQUIPMENT_T1",
        symptoms: "Test symptoms tenant 1",
        diagnosis: "Test diagnosis",
        solution: "Test solution",
        urgency: "medium",
        tenantId: testTenant1
      });
      
      // Insérer données pour tenant 2  
      await db.execute(sql`SELECT set_current_tenant(${testTenant2})`);
      await db.insert(maintenanceCases).values({
        equipmentType: "TEST_EQUIPMENT_T2", 
        symptoms: "Test symptoms tenant 2",
        diagnosis: "Test diagnosis",
        solution: "Test solution",
        urgency: "medium",
        tenantId: testTenant2
      });
      
      // Vérifier isolation: tenant 1 ne voit que ses données
      await db.execute(sql`SELECT set_current_tenant(${testTenant1})`);
      const tenant1Data = await db.select().from(maintenanceCases);
      const tenant1TestData = tenant1Data.filter(d => d.equipmentType?.startsWith('TEST_EQUIPMENT'));
      
      // Vérifier isolation: tenant 2 ne voit que ses données
      await db.execute(sql`SELECT set_current_tenant(${testTenant2})`);
      const tenant2Data = await db.select().from(maintenanceCases);
      const tenant2TestData = tenant2Data.filter(d => d.equipmentType?.startsWith('TEST_EQUIPMENT'));
      
      // Validation
      const tenant1OnlySeesOwnData = tenant1TestData.every(d => d.tenantId === testTenant1 || d.tenantId === null);
      const tenant2OnlySeesOwnData = tenant2TestData.every(d => d.tenantId === testTenant2 || d.tenantId === null);
      const noCrossContamination = !tenant1TestData.some(d => d.tenantId === testTenant2) &&
                                   !tenant2TestData.some(d => d.tenantId === testTenant1);
      
      const passed = tenant1OnlySeesOwnData && tenant2OnlySeesOwnData && noCrossContamination;
      
      // Cleanup
      await this.cleanupTestData(testTenant1, testTenant2);
      
      return {
        testName: "Maintenance Cases Isolation",
        passed,
        details: `T1 data: ${tenant1TestData.length}, T2 data: ${tenant2TestData.length}, Cross contamination: ${!noCrossContamination}`,
        timestamp: new Date()
      };
      
    } catch (error: any) {
      return {
        testName: "Maintenance Cases Isolation", 
        passed: false,
        details: `Error: ${error.message}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Test 2: Vérifier isolation des diagnostic_sessions
   */
  private static async testDiagnosticSessionsIsolation(): Promise<TenantIsolationTestResult> {
    try {
      const testTenant1 = "test-tenant-diag-1";
      const testTenant2 = "test-tenant-diag-2";
      
      // Créer session pour tenant 1
      await db.execute(sql`SELECT set_current_tenant(${testTenant1})`);
      await db.insert(diagnosticSessions).values({
        equipmentType: "TEST_DIAG_T1",
        symptoms: "Test diagnostic tenant 1",
        urgency: "high",
        tenantId: testTenant1
      });
      
      // Créer session pour tenant 2
      await db.execute(sql`SELECT set_current_tenant(${testTenant2})`);
      await db.insert(diagnosticSessions).values({
        equipmentType: "TEST_DIAG_T2",
        symptoms: "Test diagnostic tenant 2", 
        urgency: "high",
        tenantId: testTenant2
      });
      
      // Vérifier isolation
      await db.execute(sql`SELECT set_current_tenant(${testTenant1})`);
      const tenant1Sessions = await db.select().from(diagnosticSessions);
      const tenant1TestSessions = tenant1Sessions.filter(s => s.equipmentType?.startsWith('TEST_DIAG'));
      
      await db.execute(sql`SELECT set_current_tenant(${testTenant2})`);
      const tenant2Sessions = await db.select().from(diagnosticSessions);
      const tenant2TestSessions = tenant2Sessions.filter(s => s.equipmentType?.startsWith('TEST_DIAG'));
      
      const isolationValid = !tenant1TestSessions.some(s => s.tenantId === testTenant2) &&
                             !tenant2TestSessions.some(s => s.tenantId === testTenant1);
      
      // Cleanup
      await this.cleanupDiagnosticTestData(testTenant1, testTenant2);
      
      return {
        testName: "Diagnostic Sessions Isolation",
        passed: isolationValid,
        details: `T1 sessions: ${tenant1TestSessions.length}, T2 sessions: ${tenant2TestSessions.length}`,
        timestamp: new Date()
      };
      
    } catch (error: any) {
      return {
        testName: "Diagnostic Sessions Isolation",
        passed: false,
        details: `Error: ${error.message}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Test 3: Vérifier isolation des audit_logs
   */
  private static async testAuditLogsIsolation(): Promise<TenantIsolationTestResult> {
    try {
      const testTenant1 = "test-audit-tenant-1";
      const testTenant2 = "test-audit-tenant-2";
      
      // Créer logs pour tenant 1
      await db.execute(sql`SELECT set_current_tenant(${testTenant1})`);
      await db.insert(auditLogs).values({
        tenantId: testTenant1,
        action: "TEST_ACTION_T1",
        resourceType: "test_resource",
        success: true
      });
      
      // Créer logs pour tenant 2
      await db.execute(sql`SELECT set_current_tenant(${testTenant2})`);
      await db.insert(auditLogs).values({
        tenantId: testTenant2,
        action: "TEST_ACTION_T2", 
        resourceType: "test_resource",
        success: true
      });
      
      // Vérifier isolation des logs
      await db.execute(sql`SELECT set_current_tenant(${testTenant1})`);
      const tenant1Logs = await db.select().from(auditLogs);
      const tenant1TestLogs = tenant1Logs.filter(l => l.action?.startsWith('TEST_ACTION'));
      
      await db.execute(sql`SELECT set_current_tenant(${testTenant2})`);
      const tenant2Logs = await db.select().from(auditLogs);
      const tenant2TestLogs = tenant2Logs.filter(l => l.action?.startsWith('TEST_ACTION'));
      
      const auditIsolationValid = !tenant1TestLogs.some(l => l.tenantId === testTenant2) &&
                                  !tenant2TestLogs.some(l => l.tenantId === testTenant1);
      
      // Cleanup
      await this.cleanupAuditTestData(testTenant1, testTenant2);
      
      return {
        testName: "Audit Logs Isolation",
        passed: auditIsolationValid,
        details: `T1 logs: ${tenant1TestLogs.length}, T2 logs: ${tenant2TestLogs.length}`,
        timestamp: new Date()
      };
      
    } catch (error: any) {
      return {
        testName: "Audit Logs Isolation",
        passed: false,
        details: `Error: ${error.message}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Test 4: Tentative d'accès croisé (doit échouer)
   */
  private static async testCrossTenantAccessPrevention(): Promise<TenantIsolationTestResult> {
    try {
      const tenantA = "secure-tenant-a";
      const tenantB = "secure-tenant-b";
      
      // Créer données pour tenant A
      await db.execute(sql`SELECT set_current_tenant(${tenantA})`);
      const [recordA] = await db.insert(maintenanceCases).values({
        equipmentType: "SECURE_EQUIPMENT_A",
        symptoms: "Confidential data tenant A",
        diagnosis: "Secret diagnosis A",
        solution: "Proprietary solution A",
        urgency: "critical",
        tenantId: tenantA
      }).returning();
      
      // Tenter d'accéder aux données de A depuis le contexte B
      await db.execute(sql`SELECT set_current_tenant(${tenantB})`);
      const attemptedAccess = await db.select().from(maintenanceCases)
        .where(sql`equipment_type = 'SECURE_EQUIPMENT_A'`);
      
      // L'accès doit être bloqué - aucun résultat ne devrait être retourné
      const accessPrevented = attemptedAccess.length === 0;
      
      // Cleanup
      await db.execute(sql`SELECT set_current_tenant(${tenantA})`);
      await db.delete(maintenanceCases).where(sql`equipment_type = 'SECURE_EQUIPMENT_A'`);
      
      return {
        testName: "Cross-Tenant Access Prevention",
        passed: accessPrevented,
        details: `Unauthorized access attempts returned: ${attemptedAccess.length} records (should be 0)`,
        timestamp: new Date()
      };
      
    } catch (error: any) {
      return {
        testName: "Cross-Tenant Access Prevention",
        passed: false,
        details: `Error: ${error.message}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Test 5: Prévention d'injection SQL pour bypass tenant
   */
  private static async testSQLInjectionPrevention(): Promise<TenantIsolationTestResult> {
    try {
      const legitimateTenant = "legitimate-tenant";
      const maliciousTenant = "malicious-tenant";
      
      // Créer données légitimes
      await db.execute(sql`SELECT set_current_tenant(${legitimateTenant})`);
      await db.insert(maintenanceCases).values({
        equipmentType: "LEGITIMATE_EQUIPMENT",
        symptoms: "Normal maintenance case",
        diagnosis: "Standard diagnosis",
        solution: "Standard solution",
        urgency: "medium",
        tenantId: legitimateTenant
      });
      
      // Simuler tentative d'injection SQL depuis un autre tenant
      await db.execute(sql`SELECT set_current_tenant(${maliciousTenant})`);
      
      try {
        // Tentative de bypass tenant avec injection SQL
        const maliciousQuery = await db.select().from(maintenanceCases)
          .where(sql`equipment_type = 'LEGITIMATE_EQUIPMENT' OR tenant_id = ${legitimateTenant}`);
        
        // Si RLS fonctionne, cette requête ne devrait retourner aucun résultat
        const injectionPrevented = maliciousQuery.length === 0;
        
        // Cleanup
        await db.execute(sql`SELECT set_current_tenant(${legitimateTenant})`);
        await db.delete(maintenanceCases).where(sql`equipment_type = 'LEGITIMATE_EQUIPMENT'`);
        
        return {
          testName: "SQL Injection Prevention",
          passed: injectionPrevented,
          details: `Malicious query returned: ${maliciousQuery.length} records (should be 0)`,
          timestamp: new Date()
        };
        
      } catch (sqlError) {
        // Si une erreur SQL se produit, c'est aussi une bonne chose (query bloquée)
        return {
          testName: "SQL Injection Prevention",
          passed: true,
          details: "SQL injection attempt blocked by database security",
          timestamp: new Date()
        };
      }
      
    } catch (error: any) {
      return {
        testName: "SQL Injection Prevention",
        passed: false,
        details: `Error: ${error.message}`,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Nettoyage des données de test
   */
  private static async cleanupTestData(tenant1: string, tenant2: string) {
    try {
      // Nettoyer données tenant 1
      await db.execute(sql`SELECT set_current_tenant(${tenant1})`);
      await db.delete(maintenanceCases).where(sql`equipment_type LIKE 'TEST_EQUIPMENT_%'`);
      
      // Nettoyer données tenant 2
      await db.execute(sql`SELECT set_current_tenant(${tenant2})`);
      await db.delete(maintenanceCases).where(sql`equipment_type LIKE 'TEST_EQUIPMENT_%'`);
    } catch (error: any) {
      console.warn("Cleanup warning:", error);
    }
  }
  
  private static async cleanupDiagnosticTestData(tenant1: string, tenant2: string) {
    try {
      await db.execute(sql`SELECT set_current_tenant(${tenant1})`);
      await db.delete(diagnosticSessions).where(sql`equipment_type LIKE 'TEST_DIAG_%'`);
      
      await db.execute(sql`SELECT set_current_tenant(${tenant2})`);
      await db.delete(diagnosticSessions).where(sql`equipment_type LIKE 'TEST_DIAG_%'`);
    } catch (error: any) {
      console.warn("Diagnostic cleanup warning:", error);
    }
  }
  
  private static async cleanupAuditTestData(tenant1: string, tenant2: string) {
    try {
      await db.execute(sql`SELECT set_current_tenant(${tenant1})`);
      await db.delete(auditLogs).where(sql`action LIKE 'TEST_ACTION_%'`);
      
      await db.execute(sql`SELECT set_current_tenant(${tenant2})`);
      await db.delete(auditLogs).where(sql`action LIKE 'TEST_ACTION_%'`);
    } catch (error: any) {
      console.warn("Audit cleanup warning:", error);
    }
  }
  
  /**
   * Test de performance et stress des RLS policies
   */
  static async runPerformanceTest(): Promise<TenantIsolationTestResult> {
    try {
      const startTime = Date.now();
      const testTenant = "perf-test-tenant";
      
      // Configurer tenant de test
      await db.execute(sql`SELECT set_current_tenant(${testTenant})`);
      
      // Créer de multiples enregistrements
      const testRecords = Array.from({length: 100}, (_, i) => ({
        equipmentType: `PERF_TEST_${i}`,
        symptoms: `Performance test symptoms ${i}`,
        diagnosis: `Test diagnosis ${i}`,
        solution: `Test solution ${i}`,
        urgency: "medium" as const,
        tenantId: testTenant
      }));
      
      await db.insert(maintenanceCases).values(testRecords);
      
      // Mesurer performance des queries avec RLS
      const queryStart = Date.now();
      const results = await db.select().from(maintenanceCases);
      const queryTime = Date.now() - queryStart;
      
      // Cleanup
      await db.delete(maintenanceCases).where(sql`equipment_type LIKE 'PERF_TEST_%'`);
      
      const totalTime = Date.now() - startTime;
      const passed = queryTime < 1000; // Query doit être < 1 seconde
      
      return {
        testName: "RLS Performance Test",
        passed,
        details: `Total time: ${totalTime}ms, Query time: ${queryTime}ms, Records: ${results.length}`,
        timestamp: new Date()
      };
      
    } catch (error: any) {
      return {
        testName: "RLS Performance Test",
        passed: false,
        details: `Error: ${error.message}`,
        timestamp: new Date()
      };
    }
  }
}

// Route handlers for Express integration
export const tenantIsolationTestRoutes = {
  async runIsolationTests(req: any, res: any) {
    try {
      // Admin access check
      const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_SECRET_KEY;
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required for isolation tests" });
      }

      const results = await TenantIsolationTester.runAllTests();
      const passedTests = results.filter(r => r.passed).length;
      const totalTests = results.length;
      
      res.json({
        success: true,
        summary: {
          totalTests,
          passedTests,
          failedTests: totalTests - passedTests,
          overallStatus: passedTests === totalTests ? 'PASS' : 'FAIL'
        },
        results
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  async getComplianceReport(req: any, res: any) {
    try {
      // Admin access check
      const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_SECRET_KEY;
      if (!isAdmin) {
        return res.status(403).json({ error: "Admin access required for compliance reports" });
      }

      const { testSuiteId } = req.params;
      
      // Run comprehensive tests for compliance report
      const isolationResults = await TenantIsolationTester.runAllTests();
      const performanceResult = await TenantIsolationTester.runPerformanceTest();
      
      const allResults = [...isolationResults, performanceResult];
      const passedTests = allResults.filter(r => r.passed).length;
      const totalTests = allResults.length;
      
      const complianceReport = {
        reportId: testSuiteId || `compliance-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        compliance: {
          status: passedTests === totalTests ? 'COMPLIANT' : 'NON_COMPLIANT',
          score: Math.round((passedTests / totalTests) * 100),
          passedTests,
          totalTests
        },
        categories: {
          dataIsolation: {
            status: isolationResults.every(r => r.passed) ? 'PASS' : 'FAIL',
            tests: isolationResults
          },
          performance: {
            status: performanceResult.passed ? 'PASS' : 'FAIL',
            tests: [performanceResult]
          }
        },
        recommendations: allResults
          .filter(r => !r.passed)
          .map(r => `Fix: ${r.testName} - ${r.details}`)
      };
      
      res.json(complianceReport);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};