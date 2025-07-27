/**
 * Routes API sécurisées pour les paiements Smart GMAO DiagFix
 * Conformité PCI-DSS avec middleware de sécurité avancé
 * VERSION FREEMIUM: Routes préparées mais désactivées
 */

import { Express, Request, Response } from "express";
import helmet from "helmet";
import { 
  paymentService, 
  paymentRateLimit, 
  webhookRateLimit,
  PAYMENT_CONFIG,
  SecurePaymentData 
} from "./payment-infrastructure";

// Middleware de sécurité PCI-DSS
const pciSecurityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "js.stripe.com", "www.paypal.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "api.stripe.com", "api.paypal.com"],
      frameSrc: ["js.stripe.com", "www.paypal.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Middleware de validation des données de paiement
const validatePaymentRequest = (req: Request, res: Response, next: Function) => {
  if (PAYMENT_CONFIG.FREEMIUM_MODE) {
    return res.status(403).json({
      error: "Payment functionality disabled",
      message: "This feature will be available in paid versions. Enjoy the complete freemium version!",
      freemiumMode: true
    });
  }
  
  const { amount, currency, planType } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({
      error: "Invalid amount",
      message: "Amount must be greater than 0"
    });
  }
  
  if (!currency || !['EUR', 'USD'].includes(currency)) {
    return res.status(400).json({
      error: "Invalid currency",
      message: "Currency must be EUR or USD"
    });
  }
  
  if (!planType || !['pro', 'business', 'enterprise'].includes(planType)) {
    return res.status(400).json({
      error: "Invalid plan type",
      message: "Plan type must be pro, business, or enterprise"
    });
  }
  
  next();
};

// Middleware de logging sécurisé
const securePaymentLogger = (req: Request, res: Response, next: Function) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent')?.slice(0, 100), // Tronquer pour la sécurité
      ip: req.ip,
      // Pas de données sensibles dans les logs
    };
    
    if (PAYMENT_CONFIG.COMPLIANCE.AUDIT_LOGGING) {
      console.log('[PAYMENT_API_LOG]', JSON.stringify(logData));
    }
  });
  
  next();
};

export function registerPaymentRoutes(app: Express): void {
  // Application des middlewares de sécurité
  app.use('/api/payment', pciSecurityHeaders);
  app.use('/api/payment', securePaymentLogger);
  
  // Route de vérification du statut des paiements
  app.get('/api/payment/status', (req: Request, res: Response) => {
    res.json({
      freemiumMode: PAYMENT_CONFIG.FREEMIUM_MODE,
      availableGateways: paymentService.getAvailableGateways(),
      supportedCurrencies: ['EUR', 'USD'],
      supportedPlans: ['pro', 'business', 'enterprise'],
      pciCompliant: true,
      version: "1.0.0"
    });
  });
  
  // Route de création d'intention de paiement Stripe
  app.post('/api/payment/stripe/create-intent', 
    paymentRateLimit,
    validatePaymentRequest,
    async (req: Request, res: Response) => {
      try {
        const paymentData: SecurePaymentData = {
          amount: req.body.amount,
          currency: req.body.currency,
          customerId: req.body.customerId || `customer_${Date.now()}`,
          planType: req.body.planType,
          billingCycle: req.body.billingCycle || 'monthly',
          metadata: {
            userId: req.body.userId || 'anonymous',
            subscriptionType: req.body.subscriptionType || 'standard',
            createdAt: new Date().toISOString()
          }
        };
        
        const result = await paymentService.processPayment('stripe', paymentData);
        
        if (result.success) {
          res.json({
            success: true,
            clientSecret: result.clientSecret,
            transactionId: result.transactionId
          });
        } else {
          res.status(400).json({
            error: result.error,
            gateway: result.gateway
          });
        }
      } catch (error: any) {
        console.error('Stripe payment creation failed:', error);
        res.status(500).json({
          error: "Internal payment processing error",
          message: "Please try again later"
        });
      }
    }
  );
  
  // Route de création d'abonnement Stripe
  app.post('/api/payment/stripe/create-subscription',
    paymentRateLimit,
    validatePaymentRequest,
    async (req: Request, res: Response) => {
      try {
        const subscriptionData: SecurePaymentData = {
          amount: req.body.amount,
          currency: req.body.currency,
          customerId: req.body.customerId,
          planType: req.body.planType,
          billingCycle: req.body.billingCycle || 'monthly',
          metadata: {
            userId: req.body.userId,
            subscriptionType: 'recurring',
            createdAt: new Date().toISOString()
          }
        };
        
        const result = await paymentService.createSubscription('stripe', subscriptionData);
        
        if (result.success) {
          res.json({
            success: true,
            subscriptionId: result.subscriptionId,
            clientSecret: result.clientSecret
          });
        } else {
          res.status(400).json({
            error: result.error,
            gateway: result.gateway
          });
        }
      } catch (error: any) {
        console.error('Stripe subscription creation failed:', error);
        res.status(500).json({
          error: "Internal subscription processing error",
          message: "Please try again later"
        });
      }
    }
  );
  
  // Route de création d'ordre PayPal
  app.post('/api/payment/paypal/create-order',
    paymentRateLimit,
    validatePaymentRequest,
    async (req: Request, res: Response) => {
      try {
        const paymentData: SecurePaymentData = {
          amount: req.body.amount,
          currency: req.body.currency,
          customerId: req.body.customerId || `paypal_customer_${Date.now()}`,
          planType: req.body.planType,
          billingCycle: req.body.billingCycle || 'monthly',
          metadata: {
            userId: req.body.userId || 'anonymous',
            subscriptionType: req.body.subscriptionType || 'standard',
            createdAt: new Date().toISOString()
          }
        };
        
        const result = await paymentService.processPayment('paypal', paymentData);
        
        if (result.success) {
          res.json({
            success: true,
            orderId: result.transactionId,
            clientSecret: result.clientSecret
          });
        } else {
          res.status(400).json({
            error: result.error,
            gateway: result.gateway
          });
        }
      } catch (error: any) {
        console.error('PayPal order creation failed:', error);
        res.status(500).json({
          error: "Internal payment processing error",
          message: "Please try again later"
        });
      }
    }
  );
  
  // Route de création d'abonnement PayPal
  app.post('/api/payment/paypal/create-subscription',
    paymentRateLimit,
    validatePaymentRequest,
    async (req: Request, res: Response) => {
      try {
        const subscriptionData: SecurePaymentData = {
          amount: req.body.amount,
          currency: req.body.currency,
          customerId: req.body.customerId,
          planType: req.body.planType,
          billingCycle: req.body.billingCycle || 'monthly',
          metadata: {
            userId: req.body.userId,
            subscriptionType: 'recurring',
            createdAt: new Date().toISOString()
          }
        };
        
        const result = await paymentService.createSubscription('paypal', subscriptionData);
        
        if (result.success) {
          res.json({
            success: true,
            subscriptionId: result.subscriptionId,
            approvalUrl: result.clientSecret // PayPal utilise une URL d'approbation
          });
        } else {
          res.status(400).json({
            error: result.error,
            gateway: result.gateway
          });
        }
      } catch (error: any) {
        console.error('PayPal subscription creation failed:', error);
        res.status(500).json({
          error: "Internal subscription processing error",
          message: "Please try again later"
        });
      }
    }
  );
  
  // Webhook Stripe (pour synchronisation des paiements)
  app.post('/api/payment/stripe/webhook',
    webhookRateLimit,
    async (req: Request, res: Response) => {
      if (PAYMENT_CONFIG.FREEMIUM_MODE) {
        return res.status(403).json({
          error: "Webhook processing disabled in freemium mode"
        });
      }
      
      try {
        const gateway = paymentService['gateways']?.get('stripe');
        if (gateway) {
          await gateway.processWebhook(req);
          res.json({ received: true });
        } else {
          res.status(400).json({ error: "Stripe gateway not available" });
        }
      } catch (error: any) {
        console.error('Stripe webhook processing failed:', error);
        res.status(400).json({ error: "Webhook processing failed" });
      }
    }
  );
  
  // Webhook PayPal (pour synchronisation des paiements)
  app.post('/api/payment/paypal/webhook',
    webhookRateLimit,
    async (req: Request, res: Response) => {
      if (PAYMENT_CONFIG.FREEMIUM_MODE) {
        return res.status(403).json({
          error: "Webhook processing disabled in freemium mode"
        });
      }
      
      try {
        const gateway = paymentService['gateways']?.get('paypal');
        if (gateway) {
          await gateway.processWebhook(req);
          res.json({ received: true });
        } else {
          res.status(400).json({ error: "PayPal gateway not available" });
        }
      } catch (error: any) {
        console.error('PayPal webhook processing failed:', error);
        res.status(400).json({ error: "Webhook processing failed" });
      }
    }
  );
  
  // Route d'annulation d'abonnement (pour futures versions)
  app.post('/api/payment/cancel-subscription',
    paymentRateLimit,
    async (req: Request, res: Response) => {
      if (PAYMENT_CONFIG.FREEMIUM_MODE) {
        return res.status(403).json({
          error: "Subscription management disabled in freemium mode"
        });
      }
      
      const { subscriptionId, gateway } = req.body;
      
      if (!subscriptionId || !gateway) {
        return res.status(400).json({
          error: "Missing subscription ID or gateway"
        });
      }
      
      try {
        const paymentGateway = paymentService['gateways']?.get(gateway);
        if (!paymentGateway) {
          return res.status(400).json({
            error: `Gateway ${gateway} not available`
          });
        }
        
        const success = await paymentGateway.cancelSubscription(subscriptionId);
        
        res.json({
          success,
          subscriptionId,
          gateway
        });
      } catch (error: any) {
        console.error('Subscription cancellation failed:', error);
        res.status(500).json({
          error: "Subscription cancellation failed"
        });
      }
    }
  );
  
  // Route de configuration de sécurité (pour vérification PCI-DSS)
  app.get('/api/payment/security-config', (req: Request, res: Response) => {
    res.json({
      pciDssCompliant: true,
      encryptionEnabled: true,
      tokenizationEnabled: PAYMENT_CONFIG.COMPLIANCE.TOKENIZATION,
      auditLoggingEnabled: PAYMENT_CONFIG.COMPLIANCE.AUDIT_LOGGING,
      dataRetentionDays: PAYMENT_CONFIG.COMPLIANCE.DATA_RETENTION_DAYS,
      rateLimitEnabled: true,
      secureHeaders: true,
      webhookValidation: true,
      freemiumMode: PAYMENT_CONFIG.FREEMIUM_MODE
    });
  });
}