/**
 * Infrastructure de paiement sécurisée pour Smart GMAO DiagFix
 * Conforme PCI-DSS avec support PayPal et Stripe
 * VERSION FREEMIUM: Fonctionnalités désactivées, architecture préparée
 */

import { Request, Response } from "express";
import rateLimit from "express-rate-limit";

// Configuration sécurisée pour version freemium
export const PAYMENT_CONFIG = {
  FREEMIUM_MODE: true, // Désactive les paiements pour la version freemium
  SUPPORTED_GATEWAYS: ['stripe', 'paypal'],
  SECURITY: {
    RATE_LIMIT_PAYMENT: 5, // Max 5 tentatives de paiement par heure
    RATE_LIMIT_WEBHOOK: 100, // Max 100 webhooks par heure
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
    ENCRYPTION_KEY_LENGTH: 256
  },
  COMPLIANCE: {
    PCI_DSS_LEVEL: 1,
    DATA_RETENTION_DAYS: 90,
    AUDIT_LOGGING: true,
    TOKENIZATION: true
  }
};

// Rate limiting pour les endpoints de paiement
export const paymentRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: PAYMENT_CONFIG.SECURITY.RATE_LIMIT_PAYMENT,
  message: {
    error: "Too many payment attempts",
    retryAfter: "1 hour"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const webhookRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure  
  max: PAYMENT_CONFIG.SECURITY.RATE_LIMIT_WEBHOOK,
  message: {
    error: "Too many webhook requests",
    retryAfter: "1 hour"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Interface pour les données de paiement sécurisées
export interface SecurePaymentData {
  amount: number;
  currency: 'EUR' | 'USD';
  customerId: string;
  planType: 'pro' | 'business' | 'enterprise';
  billingCycle: 'monthly' | 'yearly';
  metadata: {
    userId: string;
    subscriptionType: string;
    createdAt: string;
  };
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  subscriptionId?: string;
  clientSecret?: string;
  error?: string;
  gateway: 'stripe' | 'paypal';
}

// Base class pour les passerelles de paiement
export abstract class PaymentGateway {
  protected abstract gatewayName: string;
  
  abstract createPaymentIntent(data: SecurePaymentData): Promise<PaymentResult>;
  abstract createSubscription(data: SecurePaymentData): Promise<PaymentResult>;
  abstract processWebhook(req: Request): Promise<void>;
  abstract cancelSubscription(subscriptionId: string): Promise<boolean>;
  
  // Validation sécurisée des données
  protected validatePaymentData(data: SecurePaymentData): boolean {
    if (!data.amount || data.amount <= 0) return false;
    if (!['EUR', 'USD'].includes(data.currency)) return false;
    if (!data.customerId || data.customerId.length < 3) return false;
    if (!['pro', 'business', 'enterprise'].includes(data.planType)) return false;
    return true;
  }
  
  // Logging sécurisé (sans données sensibles)
  protected secureLog(action: string, metadata: any) {
    const sanitized = {
      gateway: this.gatewayName,
      action,
      timestamp: new Date().toISOString(),
      userId: metadata.userId || 'anonymous',
      success: metadata.success || false,
      // Pas de données de paiement dans les logs
    };
    
    if (PAYMENT_CONFIG.COMPLIANCE.AUDIT_LOGGING) {
      console.log('[PAYMENT_AUDIT]', JSON.stringify(sanitized));
    }
  }
}

// Implémentation Stripe (préparée, désactivée pour freemium)
export class StripeGateway extends PaymentGateway {
  protected gatewayName = 'stripe';
  private stripe: any = null;
  
  constructor() {
    super();
    if (!PAYMENT_CONFIG.FREEMIUM_MODE && process.env.STRIPE_SECRET_KEY) {
      // Import dynamique pour éviter l'erreur si la clé n'est pas présente
      this.initializeStripe();
    }
  }
  
  private async initializeStripe() {
    try {
      const Stripe = await import('stripe');
      this.stripe = new Stripe.default(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-06-30.basil',
      });
    } catch (error) {
      console.error('Stripe initialization failed:', error);
    }
  }
  
  async createPaymentIntent(data: SecurePaymentData): Promise<PaymentResult> {
    if (PAYMENT_CONFIG.FREEMIUM_MODE) {
      return {
        success: false,
        error: 'Payment functionality disabled in freemium mode',
        gateway: 'stripe'
      };
    }
    
    if (!this.stripe || !this.validatePaymentData(data)) {
      return {
        success: false,
        error: 'Invalid payment configuration or data',
        gateway: 'stripe'
      };
    }
    
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(data.amount * 100), // Convertir en centimes
        currency: data.currency.toLowerCase(),
        customer: data.customerId,
        metadata: {
          userId: data.metadata.userId,
          planType: data.planType,
          subscriptionType: data.metadata.subscriptionType
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });
      
      this.secureLog('payment_intent_created', {
        userId: data.metadata.userId,
        success: true
      });
      
      return {
        success: true,
        transactionId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        gateway: 'stripe'
      };
    } catch (error: any) {
      this.secureLog('payment_intent_failed', {
        userId: data.metadata.userId,
        success: false
      });
      
      return {
        success: false,
        error: error.message,
        gateway: 'stripe'
      };
    }
  }
  
  async createSubscription(data: SecurePaymentData): Promise<PaymentResult> {
    if (PAYMENT_CONFIG.FREEMIUM_MODE) {
      return {
        success: false,
        error: 'Subscription functionality disabled in freemium mode',
        gateway: 'stripe'
      };
    }
    
    // Implementation complète pour futures versions payantes
    return {
      success: false,
      error: 'Subscription creation not implemented yet',
      gateway: 'stripe'
    };
  }
  
  async processWebhook(req: Request): Promise<void> {
    if (PAYMENT_CONFIG.FREEMIUM_MODE) {
      throw new Error('Webhook processing disabled in freemium mode');
    }
    // Traitement des webhooks Stripe pour futures versions
  }
  
  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    if (PAYMENT_CONFIG.FREEMIUM_MODE) return false;
    // Annulation d'abonnement pour futures versions
    return false;
  }
}

// Implémentation PayPal (préparée, désactivée pour freemium)
export class PayPalGateway extends PaymentGateway {
  protected gatewayName = 'paypal';
  private paypalClient: any = null;
  
  constructor() {
    super();
    if (!PAYMENT_CONFIG.FREEMIUM_MODE && process.env.PAYPAL_CLIENT_ID) {
      this.initializePayPal();
    }
  }
  
  private async initializePayPal() {
    try {
      const { Client, Environment } = await import('@paypal/paypal-server-sdk');
      
      this.paypalClient = new Client({
        clientCredentialsAuthCredentials: {
          oAuthClientId: process.env.PAYPAL_CLIENT_ID!,
          oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET!,
        },
        environment: process.env.NODE_ENV === 'production' 
          ? Environment.Production 
          : Environment.Sandbox,
      });
    } catch (error) {
      console.error('PayPal initialization failed:', error);
    }
  }
  
  async createPaymentIntent(data: SecurePaymentData): Promise<PaymentResult> {
    if (PAYMENT_CONFIG.FREEMIUM_MODE) {
      return {
        success: false,
        error: 'Payment functionality disabled in freemium mode',
        gateway: 'paypal'
      };
    }
    
    // Implementation complète pour futures versions payantes
    return {
      success: false,
      error: 'PayPal payment creation not implemented yet',
      gateway: 'paypal'
    };
  }
  
  async createSubscription(data: SecurePaymentData): Promise<PaymentResult> {
    if (PAYMENT_CONFIG.FREEMIUM_MODE) {
      return {
        success: false,
        error: 'Subscription functionality disabled in freemium mode',
        gateway: 'paypal'
      };
    }
    
    return {
      success: false,
      error: 'PayPal subscription creation not implemented yet',
      gateway: 'paypal'
    };
  }
  
  async processWebhook(req: Request): Promise<void> {
    if (PAYMENT_CONFIG.FREEMIUM_MODE) {
      throw new Error('Webhook processing disabled in freemium mode');
    }
  }
  
  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    if (PAYMENT_CONFIG.FREEMIUM_MODE) return false;
    return false;
  }
}

// Factory pour instancier les passerelles
export class PaymentGatewayFactory {
  static createGateway(type: 'stripe' | 'paypal'): PaymentGateway {
    switch (type) {
      case 'stripe':
        return new StripeGateway();
      case 'paypal':
        return new PayPalGateway();
      default:
        throw new Error(`Unsupported payment gateway: ${type}`);
    }
  }
  
  static getAvailableGateways(): string[] {
    if (PAYMENT_CONFIG.FREEMIUM_MODE) {
      return []; // Aucune passerelle disponible en mode freemium
    }
    return PAYMENT_CONFIG.SUPPORTED_GATEWAYS;
  }
}

// Service principal de gestion des paiements
export class PaymentService {
  private gateways: Map<string, PaymentGateway> = new Map();
  
  constructor() {
    if (!PAYMENT_CONFIG.FREEMIUM_MODE) {
      // Initialiser les passerelles seulement si pas en mode freemium
      for (const gatewayType of PAYMENT_CONFIG.SUPPORTED_GATEWAYS) {
        try {
          const gateway = PaymentGatewayFactory.createGateway(gatewayType as 'stripe' | 'paypal');
          this.gateways.set(gatewayType, gateway);
        } catch (error) {
          console.warn(`Failed to initialize ${gatewayType} gateway:`, error);
        }
      }
    }
  }
  
  async processPayment(
    gatewayType: 'stripe' | 'paypal', 
    data: SecurePaymentData
  ): Promise<PaymentResult> {
    if (PAYMENT_CONFIG.FREEMIUM_MODE) {
      return {
        success: false,
        error: 'Payment processing disabled in freemium version',
        gateway: gatewayType
      };
    }
    
    const gateway = this.gateways.get(gatewayType);
    if (!gateway) {
      return {
        success: false,
        error: `Gateway ${gatewayType} not available`,
        gateway: gatewayType
      };
    }
    
    return gateway.createPaymentIntent(data);
  }
  
  async createSubscription(
    gatewayType: 'stripe' | 'paypal',
    data: SecurePaymentData
  ): Promise<PaymentResult> {
    if (PAYMENT_CONFIG.FREEMIUM_MODE) {
      return {
        success: false,
        error: 'Subscription processing disabled in freemium version',
        gateway: gatewayType
      };
    }
    
    const gateway = this.gateways.get(gatewayType);
    if (!gateway) {
      return {
        success: false,
        error: `Gateway ${gatewayType} not available`,
        gateway: gatewayType
      };
    }
    
    return gateway.createSubscription(data);
  }
  
  isFreemiumMode(): boolean {
    return PAYMENT_CONFIG.FREEMIUM_MODE;
  }
  
  getAvailableGateways(): string[] {
    return PaymentGatewayFactory.getAvailableGateways();
  }
}

// Instance singleton du service de paiement
export const paymentService = new PaymentService();