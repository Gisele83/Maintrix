import type { Request, Response, NextFunction } from "express";
import {
  NIVEAU_IMPORT_MASSE,
  ROUTE_VALIDATION_SANS_ECRITURE,
  peutImporterEnMasse,
} from "@shared/import-en-masse";

/**
 * Le refus nomme la porte qui reste ouverte.
 *
 * Le seuil et sa justification vivent dans `shared/import-en-masse.ts` : le
 * serveur refuse, l'interface explique, et les deux lisent la même valeur.
 */
const MESSAGE_REFUS =
  "Charger un fichier crée des données en masse, et aucune annulation en masse " +
  "n'existe : cette opération demande au moins un responsable maintenance. " +
  `Vous pouvez vérifier votre fichier sans l'importer (POST ${ROUTE_VALIDATION_SANS_ECRITURE}), ` +
  "puis le faire charger par un responsable.";

/**
 * Garde de niveau pour les routes d'import en masse.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI UN MIDDLEWARE, ET PAS UN CONTRÔLE DANS LE CORPS
 * ═══════════════════════════════════════════════════════════════════
 * Deux des routes visées font parser le fichier AVANT d'entrer dans leur
 * gestionnaire (`upload.single('file')` de multer, `uploadMiddleware`). Un
 * contrôle écrit dans le corps aurait donc laissé un appelant non habilité
 * faire lire, filtrer et mettre en mémoire un fichier de 5 Mo avant d'être
 * refusé — un refus qui coûte exactement le travail qu'il refuse. Posé en
 * middleware AVANT multer, le refus intervient sans qu'une ligne du fichier
 * soit lue.
 *
 * Le contrôle échoue fermé : sans identité sur la requête, `peutImporterEnMasse`
 * est faux, donc on refuse au lieu d'accepter par défaut. Toutes les routes
 * d'import sont déclarées après `app.use('/api', requireAuthentication)`
 * (server/routes.ts), donc `req.user` y est posé par la session — jamais par
 * le corps de la requête.
 */
export function exigeNiveauImportMasse(req: Request, res: Response, next: NextFunction) {
  if (!peutImporterEnMasse((req as any).user?.role)) {
    return res.status(403).json({
      error: "FORBIDDEN",
      message: MESSAGE_REFUS,
      // L'alternative est nommée dans la réponse pour que l'interface puisse
      // l'offrir sans réécrire la règle de son côté.
      alternative: ROUTE_VALIDATION_SANS_ECRITURE,
      niveauRequis: NIVEAU_IMPORT_MASSE,
    });
  }

  next();
}
