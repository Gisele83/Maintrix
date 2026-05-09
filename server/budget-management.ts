import type { Express } from "express";
import { gmaoStorage } from "./gmao-storage";

export interface Budget {
  id: number;
  year: number;
  department: string;
  category: string; // maintenance, capex, operating
  allocatedAmount: number;
  spentAmount: number;
  reservedAmount: number; // pending approvals
  remainingAmount: number;
  approvalThresholds: {
    supervisor: number;
    manager: number;
    director: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetRequest {
  id: number;
  budgetId: number;
  requestedBy: number;
  amount: number;
  description: string;
  justification: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'approved' | 'rejected';
  approvalLevel: number; // 1=supervisor, 2=manager, 3=director
  approvedBy?: number;
  approvedAt?: Date;
  rejectedBy?: number;
  rejectedAt?: Date;
  rejectionReason?: string;
  workOrderId?: number; // linked work order
  purchaseOrderId?: number; // linked purchase order
  createdAt: Date;
  updatedAt: Date;
}

class BudgetManager {
  // Sample budget data for demonstration
  private budgets: Budget[] = [
    {
      id: 1,
      year: 2025,
      department: "maintenance",
      category: "preventive",
      allocatedAmount: 50000,
      spentAmount: 12500,
      reservedAmount: 8000,
      remainingAmount: 29500,
      approvalThresholds: { supervisor: 1000, manager: 5000, director: 15000 },
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date()
    },
    {
      id: 2,
      year: 2025,
      department: "maintenance", 
      category: "corrective",
      allocatedAmount: 75000,
      spentAmount: 23400,
      reservedAmount: 12000,
      remainingAmount: 39600,
      approvalThresholds: { supervisor: 2000, manager: 8000, director: 20000 },
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date()
    },
    {
      id: 3,
      year: 2025,
      department: "production",
      category: "capex",
      allocatedAmount: 200000,
      spentAmount: 45000,
      reservedAmount: 35000,
      remainingAmount: 120000,
      approvalThresholds: { supervisor: 5000, manager: 15000, director: 50000 },
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date()
    }
  ];

  private budgetRequests: BudgetRequest[] = [
    {
      id: 1,
      budgetId: 1,
      requestedBy: 1,
      amount: 3500,
      description: "Remplacement roulements moteur principal",
      justification: "Maintenance préventive programmée Q1 2025",
      priority: 'medium',
      status: 'pending',
      approvalLevel: 2, // requires manager approval
      workOrderId: 20,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 2,
      budgetId: 2,
      requestedBy: 2,
      amount: 850,
      description: "Pièces détachées pompe hydraulique",
      justification: "Réparation urgente suite à fuite détectée",
      priority: 'high',
      status: 'approved',
      approvalLevel: 1,
      approvedBy: 3,
      approvedAt: new Date(),
      purchaseOrderId: 15,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  async getBudgets(year?: number, department?: string): Promise<Budget[]> {
    let filtered = this.budgets;
    
    if (year) {
      filtered = filtered.filter(b => b.year === year);
    }
    
    if (department) {
      filtered = filtered.filter(b => b.department === department);
    }
    
    return filtered;
  }

  async getBudgetById(id: number): Promise<Budget | undefined> {
    return this.budgets.find(b => b.id === id);
  }

  async createBudgetRequest(request: Omit<BudgetRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<BudgetRequest> {
    const newRequest: BudgetRequest = {
      ...request,
      id: this.budgetRequests.length + 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.budgetRequests.push(newRequest);
    return newRequest;
  }

  async getBudgetRequests(status?: string, requestedBy?: number): Promise<BudgetRequest[]> {
    let filtered = this.budgetRequests;
    
    if (status) {
      filtered = filtered.filter(r => r.status === status);
    }
    
    if (requestedBy) {
      filtered = filtered.filter(r => r.requestedBy === requestedBy);
    }
    
    return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async approveBudgetRequest(requestId: number, approvedBy: number): Promise<BudgetRequest | null> {
    const requestIndex = this.budgetRequests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) return null;
    
    this.budgetRequests[requestIndex] = {
      ...this.budgetRequests[requestIndex],
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
      updatedAt: new Date()
    };
    
    // Update budget reserved amount
    const budget = await this.getBudgetById(this.budgetRequests[requestIndex].budgetId);
    if (budget) {
      budget.reservedAmount += this.budgetRequests[requestIndex].amount;
      budget.remainingAmount -= this.budgetRequests[requestIndex].amount;
      budget.updatedAt = new Date();
    }
    
    return this.budgetRequests[requestIndex];
  }

  async rejectBudgetRequest(requestId: number, rejectedBy: number, reason: string): Promise<BudgetRequest | null> {
    const requestIndex = this.budgetRequests.findIndex(r => r.id === requestId);
    if (requestIndex === -1) return null;
    
    this.budgetRequests[requestIndex] = {
      ...this.budgetRequests[requestIndex],
      status: 'rejected',
      rejectedBy,
      rejectedAt: new Date(),
      rejectionReason: reason,
      updatedAt: new Date()
    };
    
    return this.budgetRequests[requestIndex];
  }

  async getBudgetSummary(year: number = 2025): Promise<any> {
    const yearBudgets = await this.getBudgets(year);
    
    const summary = {
      year,
      totalAllocated: yearBudgets.reduce((sum, b) => sum + b.allocatedAmount, 0),
      totalSpent: yearBudgets.reduce((sum, b) => sum + b.spentAmount, 0),
      totalReserved: yearBudgets.reduce((sum, b) => sum + b.reservedAmount, 0),
      totalRemaining: yearBudgets.reduce((sum, b) => sum + b.remainingAmount, 0),
      utilizationRate: 0,
      byCategory: {} as any,
      byDepartment: {} as any
    };
    
    summary.utilizationRate = (summary.totalSpent / summary.totalAllocated) * 100;
    
    // Group by category
    yearBudgets.forEach(budget => {
      if (!summary.byCategory[budget.category]) {
        summary.byCategory[budget.category] = {
          allocated: 0,
          spent: 0,
          reserved: 0,
          remaining: 0
        };
      }
      summary.byCategory[budget.category].allocated += budget.allocatedAmount;
      summary.byCategory[budget.category].spent += budget.spentAmount;
      summary.byCategory[budget.category].reserved += budget.reservedAmount;
      summary.byCategory[budget.category].remaining += budget.remainingAmount;
    });
    
    // Group by department
    yearBudgets.forEach(budget => {
      if (!summary.byDepartment[budget.department]) {
        summary.byDepartment[budget.department] = {
          allocated: 0,
          spent: 0,
          reserved: 0,
          remaining: 0
        };
      }
      summary.byDepartment[budget.department].allocated += budget.allocatedAmount;
      summary.byDepartment[budget.department].spent += budget.spentAmount;
      summary.byDepartment[budget.department].reserved += budget.reservedAmount;
      summary.byDepartment[budget.department].remaining += budget.remainingAmount;
    });
    
    return summary;
  }
}

export const budgetManager = new BudgetManager();

export function registerBudgetRoutes(app: Express) {
  // NOTE: GET /api/budgets is handled by budget-routes.ts (registered first, with auth)
  // This file provides complementary budget management routes (summary, requests)

  // Get budget summary
  app.get("/api/budget-summary", async (req, res) => {
    try {
      const { year } = req.query;
      const summary = await budgetManager.getBudgetSummary(
        year ? parseInt(year as string) : 2025
      );
      res.json(summary);
    } catch (error) {
      console.error("Error fetching budget summary:", error);
      res.status(500).json({ message: "Failed to fetch budget summary" });
    }
  });

  // Get budget requests  
  app.get("/api/budget-requests", async (req, res) => {
    try {
      const { status, requestedBy } = req.query;
      const requests = await budgetManager.getBudgetRequests(
        status as string,
        requestedBy ? parseInt(requestedBy as string) : undefined
      );
      res.json(requests);
    } catch (error) {
      console.error("Error fetching budget requests:", error);
      res.status(500).json({ message: "Failed to fetch budget requests" });
    }
  });

  // Create budget request
  app.post("/api/budget-requests", async (req, res) => {
    try {
      const request = await budgetManager.createBudgetRequest(req.body);
      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating budget request:", error);
      res.status(400).json({ message: "Failed to create budget request" });
    }
  });

  // Approve budget request
  app.post("/api/budget-requests/:id/approve", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { approvedBy } = req.body;
      const request = await budgetManager.approveBudgetRequest(id, approvedBy);
      if (!request) {
        return res.status(404).json({ message: "Budget request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error approving budget request:", error);
      res.status(400).json({ message: "Failed to approve budget request" });
    }
  });

  // Reject budget request
  app.post("/api/budget-requests/:id/reject", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { rejectedBy, reason } = req.body;
      const request = await budgetManager.rejectBudgetRequest(id, rejectedBy, reason);
      if (!request) {
        return res.status(404).json({ message: "Budget request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error rejecting budget request:", error);
      res.status(400).json({ message: "Failed to reject budget request" });
    }
  });
}