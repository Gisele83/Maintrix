import type { Express } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { db } from "./db";
import { validationUsers, userSessions } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";

// Authentication middleware
export const authenticateUser = async (req: any, res: any, next: any) => {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionToken) {
    return res.status(401).json({ message: "Token manquant" });
  }

  try {
    // Check if session exists and is valid
    const [session] = await db
      .select()
      .from(userSessions)
      .where(and(
        eq(userSessions.sessionToken, sessionToken),
        gt(userSessions.expiresAt, new Date())
      ));

    if (!session) {
      return res.status(401).json({ message: "Session invalide ou expirée" });
    }

    // Get user details
    const [user] = await db
      .select()
      .from(validationUsers)
      .where(eq(validationUsers.id, session.userId));

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Utilisateur non autorisé" });
    }

    req.user = user;
    req.sessionId = session.id;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ message: "Erreur d'authentification" });
  }
};

export function registerAuthRoutes(app: Express) {
  // Registration endpoint
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, firstName, lastName, email, password, department, role } = req.body;

      if (!username || !password || !firstName || !lastName || !email) {
        return res.status(400).json({ 
          message: "Tous les champs obligatoires doivent être remplis" 
        });
      }

      // Check if username already exists
      const [existingUser] = await db
        .select()
        .from(validationUsers)
        .where(eq(validationUsers.username, username));

      if (existingUser) {
        return res.status(409).json({ 
          message: "Ce nom d'utilisateur existe déjà" 
        });
      }

      // Check if email already exists
      const [existingEmail] = await db
        .select()
        .from(validationUsers)
        .where(eq(validationUsers.email, email));

      if (existingEmail) {
        return res.status(409).json({ 
          message: "Cette adresse email est déjà utilisée" 
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const [newUser] = await db
        .insert(validationUsers)
        .values({
          username,
          firstName,
          lastName,
          email,
          password: hashedPassword,
          department: department || null,
          role: role || "technician",
          validationLevel: 0,
          canValidateWorkOrders: false,
          canValidatePurchaseOrders: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Return user data (without password)
      const { password: _, ...userWithoutPassword } = newUser;
      
      res.status(201).json({
        message: "Compte créé avec succès",
        user: userWithoutPassword,
      });

    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Erreur lors de la création du compte" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ 
          message: "Nom d'utilisateur et mot de passe requis" 
        });
      }

      // Find user by username
      const [user] = await db
        .select()
        .from(validationUsers)
        .where(eq(validationUsers.username, username));

      if (!user || !user.isActive) {
        return res.status(401).json({ 
          message: "Identifiants incorrects" 
        });
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ 
          message: "Identifiants incorrects" 
        });
      }

      // Update last login
      await db
        .update(validationUsers)
        .set({ lastLogin: new Date() })
        .where(eq(validationUsers.id, user.id));

      // Create session token
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Save session
      await db.insert(userSessions).values({
        userId: user.id,
        sessionToken,
        expiresAt
      });

      // Return user info and token (exclude password)
      const { password: _, ...userInfo } = user;
      res.json({
        success: true,
        user: userInfo,
        token: sessionToken,
        message: `Connexion réussie - ${user.firstName} ${user.lastName}`
      });

    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Erreur lors de la connexion" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", authenticateUser, async (req: any, res) => {
    try {
      // Delete current session
      await db
        .delete(userSessions)
        .where(eq(userSessions.id, req.sessionId));

      res.json({ success: true, message: "Déconnexion réussie" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Erreur lors de la déconnexion" });
    }
  });

  // Get current user profile
  app.get("/api/auth/profile", authenticateUser, async (req: any, res) => {
    try {
      const { password: _, ...userInfo } = req.user;
      res.json(userInfo);
    } catch (error) {
      console.error("Profile error:", error);
      res.status(500).json({ message: "Erreur lors de la récupération du profil" });
    }
  });

  // Check authentication status
  app.get("/api/auth/check", authenticateUser, async (req: any, res) => {
    res.json({ 
      authenticated: true, 
      user: {
        id: req.user.id,
        username: req.user.username,
        matricule: req.user.matricule,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        department: req.user.department,
        validationLevel: req.user.validationLevel,
        canValidateOrders: req.user.canValidateOrders,
        canValidateWorkOrders: req.user.canValidateWorkOrders
      }
    });
  });
}