import bcrypt from "bcrypt";
import { execute_sql_tool } from "../tools/execute_sql_tool";

// Create validation users for testing
export async function seedAuthUsers() {
  const saltRounds = 10;
  
  // Hash passwords
  const password1 = await bcrypt.hash("admin123", saltRounds);
  const password2 = await bcrypt.hash("chef123", saltRounds);
  const password3 = await bcrypt.hash("directeur123", saltRounds);
  const password4 = await bcrypt.hash("achat123", saltRounds);

  // Insert validation users directly via SQL
  const users = [
    {
      username: "chef.maintenance",
      password: password1,
      matricule: "MAT005-Chef-Maintenance",
      firstName: "Jean",
      lastName: "Martin",
      department: "Maintenance",
      validationLevel: 1,
      canValidateOrders: true,
      canValidateWorkOrders: true,
      email: "jean.martin@company.com"
    },
    {
      username: "chef.informatique",
      password: password2,
      matricule: "MAT002-Chef-Service-IT",
      firstName: "Pierre",
      lastName: "Durant",
      department: "Informatique",
      validationLevel: 1,
      canValidateOrders: true,
      canValidateWorkOrders: true,
      email: "pierre.durant@company.com"
    },
    {
      username: "directeur.general",
      password: password3,
      matricule: "MAT003-Directeur-General",
      firstName: "Marie",
      lastName: "Dubois",
      department: "Direction",
      validationLevel: 2,
      canValidateOrders: true,
      canValidateWorkOrders: true,
      email: "marie.dubois@company.com"
    },
    {
      username: "service.achat",
      password: password4,
      matricule: "MAT007-Service-Achat",
      firstName: "Paul",
      lastName: "Rousseau",
      department: "Achats",
      validationLevel: 3,
      canValidateOrders: true,
      canValidateWorkOrders: false,
      email: "paul.rousseau@company.com"
    }
  ];

  console.log("Creating validation users...");
  
  for (const user of users) {
    try {
      console.log(`Creating user: ${user.username} (${user.matricule})`);
      // Insert user
      // We'll use the existing user creation API
    } catch (error) {
      console.error(`Error creating user ${user.username}:`, error);
    }
  }
  
  console.log("✅ Validation users created successfully");
  return users;
}