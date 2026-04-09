const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Employee = require("../src/models/employeeModel");
const connectDB = require("../src/config/db");

// Import the existing employee data
const { employees } = require("../src/data/employees");

// Generate temporary password
function generateTempPassword() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function seedEmployees() {
  try {
    // Connect to database
    await connectDB();
    console.log("Connected to MongoDB");

    // Clear existing employees (optional - remove if you want to keep existing data)
    console.log("Clearing existing employees...");
    await Employee.deleteMany({});
    console.log("Existing employees cleared");

    const tempPasswords = [];
    const employeeData = [];

    // Process each employee
    for (const emp of employees) {
      const tempPassword = generateTempPassword();
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(tempPassword, salt);

      employeeData.push({
        email: emp.email,
        passwordHash: passwordHash,
        name: emp.name,
        position: emp.position,
        department: emp.department,
        role: emp.role,
        active: true,
        mustChangePassword: true,
        lastLogin: null,
        passwordResetAt: new Date(),
        resetVersion: 0,
      });

      tempPasswords.push({
        email: emp.email,
        name: emp.name,
        department: emp.department,
        position: emp.position,
        tempPassword: tempPassword,
      });
    }

    // Insert all employees
    console.log("Inserting employees into database...");
    const insertedEmployees = await Employee.insertMany(employeeData);
    console.log(`Successfully inserted ${insertedEmployees.length} employees`);

    // Log temporary passwords for distribution
    console.log("\n" + "=".repeat(80));
    console.log("TEMPORARY PASSWORDS - SAVE THESE FOR DISTRIBUTION");
    console.log("=".repeat(80));
    
    tempPasswords.forEach((emp, index) => {
      console.log(`\n${index + 1}. ${emp.name} (${emp.email})`);
      console.log(`   Department: ${emp.department}`);
      console.log(`   Position: ${emp.position}`);
      console.log(`   Temporary Password: ${emp.tempPassword}`);
      console.log(`   Must change password on first login: YES`);
    });
    
    console.log("\n" + "=".repeat(80));
    console.log("IMPORTANT: Email these temporary passwords to each employee.");
    console.log("Each employee will be required to change their password on first login.");
    console.log("=".repeat(80));

    // Create a CSV file for easy distribution
    const fs = require("fs");
    const csvContent = [
      "Name,Email,Department,Position,Temporary Password",
      ...tempPasswords.map(emp => 
        `"${emp.name}","${emp.email}","${emp.department}","${emp.position}","${emp.tempPassword}"`
      )
    ].join("\n");

    fs.writeFileSync("temp-passwords.csv", csvContent);
    console.log("\nTemporary passwords also saved to: temp-passwords.csv");

  } catch (error) {
    console.error("Error seeding employees:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("\nDatabase connection closed");
  }
}

// Run the seed function
seedEmployees();
