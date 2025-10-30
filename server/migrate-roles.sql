-- Migration des rôles vers le nouveau système RBAC Maintrix
-- À exécuter une seule fois pour migrer les anciens rôles

-- Ajouter la colonne sector si elle n'existe pas
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS sector VARCHAR(50);

-- Commentaire des rôles mis à jour
COMMENT ON COLUMN user_profiles.role IS 'Rôles: technician, team_leader, planner, procurement, maintenance_manager, technical_director, admin';

-- Migration des anciens rôles vers les nouveaux
-- supervisor → team_leader
UPDATE user_profiles 
SET role = 'team_leader' 
WHERE role = 'supervisor';

-- manager → maintenance_manager
UPDATE user_profiles 
SET role = 'maintenance_manager' 
WHERE role = 'manager';

-- director → technical_director
UPDATE user_profiles 
SET role = 'technical_director' 
WHERE role = 'director';

-- Directeur Technique → technical_director
UPDATE user_profiles 
SET role = 'technical_director' 
WHERE role LIKE '%Directeur%Technique%' OR role = 'Directeur  Technique';

-- Afficher le résumé de la migration
SELECT 
    role,
    COUNT(*) as user_count
FROM user_profiles
GROUP BY role
ORDER BY role;
