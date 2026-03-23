// Employee data for authentication
// This file contains all approved employees who can access the system

const employees = [
  // CEO
  {
    email: "ss.kim@cambodiacpm.com",
    name: "KIM SONG SOO",
    position: "Managing Director (MD)",
    department: "CEO",
    role: "admin"
  },

  // Department Admin (HR & ACC & IT)
  {
    email: "c.lavinn@cambodiacpm.com",
    name: "CHHEANG LAVINN",
    position: "General Manager",
    department: "Admin",
    role: "admin"
  },
  {
    email: "kim.oh@cambodiacpm.com",
    name: "KIM HYEONG OH",
    position: "Director Admin",
    department: "Admin",
    role: "admin"
  },
  {
    email: "s.khloeng@cambodiacpm.com",
    name: "SUM KHLOENG",
    position: "IT Officer",
    department: "Admin",
    role: "admin"
  },
  {
    email: "c.sopheakneth@cambodiacpm.com",
    name: "CHAN SOPHEAKNETH",
    position: "Document Controller & Admin",
    department: "Admin",
    role: "user"
  },
  {
    email: "c.danika@cambodiacpm.com",
    name: "CHAN DANIKA",
    position: "Senior Accountant",
    department: "Admin",
    role: "user"
  },
  {
    email: "o.kchny@cambodiacpm.com",
    name: "ORK INDRAKCHNY",
    position: "Admin and Accountant Assistant",
    department: "Admin",
    role: "user"
  },
  {
    email: "m.horng@cambodiacpm.com",
    name: "MENG EYHORNG",
    position: "Warehouse/Stock Controller",
    department: "Admin",
    role: "user"
  },
  {
    email: "v.sokphal@cambodiacpm.com",
    name: "NAN SOKPHAL",
    position: "Software Developer",
    department: "Admin",
    role: "user"
  },
  {
    email: "g.rida@cambodiacpm.com",
    name: "GONY RIDA",
    position: "UX/UI Designer",
    department: "Admin",
    role: "user"
  },

  // Department Architecture (AD)
  {
    email: "j.heejung@cambodiacpm.com",
    name: "JANG HEE JONG",
    position: "Architectural Design Adviser",
    department: "Architecture",
    role: "user"
  },
  {
    email: "ly.kalyan@cambodiacpm.com",
    name: "LY CHANRATANAK KALYAN",
    position: "Architectural Designer",
    department: "Architecture",
    role: "user"
  },
  {
    email: "t.tharo@cambodiacpm.com",
    name: "THAI THARO",
    position: "Architectural Designer",
    department: "Architecture",
    role: "user"
  },
  {
    email: "n.sela@cambodiacpm.com",
    name: "NONG SELA",
    position: "Architectural Designer",
    department: "Architecture",
    role: "user"
  },
  {
    email: "p.samrach@cambodiacpm.com",
    name: "PHORN SAMRACH",
    position: "Architectural Designer",
    department: "Architecture",
    role: "user"
  },
  {
    email: "c.sreyphea@cambodiacpm.com",
    name: "CHHON SREYPHEA",
    position: "Architectural Designer",
    department: "Architecture",
    role: "user"
  },
  {
    email: "h.meng@cambodiacpm.com",
    name: "HONG SUNMENG",
    position: "Architectural Designer",
    department: "Architecture",
    role: "user"
  },
  {
    email: "s.cheata@cambodiacpm.com",
    name: "SENG SOCHEATA",
    position: "Architectural Designer (AD)",
    department: "Architecture",
    role: "user"
  },

  // Department Structural & Civil (SD)
  {
    email: "h.chivinh@cambodiacpm.com",
    name: "HUY CHIVING",
    position: "Senior Structural Designer",
    department: "Structural & Civil",
    role: "user"
  },
  {
    email: "t.lisan@cambodiacpm.com",
    name: "THAP LINSAN",
    position: "Structural Designer",
    department: "Structural & Civil",
    role: "user"
  },
  {
    email: "o.chantha@cambodiacpm.com",
    name: "ORN CHANTHA",
    position: "Civil Designer",
    department: "Structural & Civil",
    role: "user"
  },

  // Department Quantity Surveyor (QS)
  {
    email: "s.sakona@cambodiacpm.com",
    name: "SOEUN VYSAKONA",
    position: "Quantity Surveyor Manager",
    department: "Quantity Surveyor",
    role: "user"
  },
  {
    email: "m.rithy@cambodiacpm.com",
    name: "MENG RITHY",
    position: "Quantity Surveyor",
    department: "Quantity Surveyor",
    role: "user"
  },
  {
    email: "p.neath@cambodiacpm.com",
    name: "PHANMAONY SOPHEAKNEATH",
    position: "Quantity Surveyor",
    department: "Quantity Surveyor",
    role: "user"
  },
  {
    email: "p.kunthea@cambodiacpm.com",
    name: "PEN KUNTHEA",
    position: "Quantity Surveyor",
    department: "Quantity Surveyor",
    role: "user"
  },
  {
    email: "p.thun@cambodiacpm.com",
    name: "VEANG PHOUTHUN",
    position: "Senior Quantity Surveyor",
    department: "Quantity Surveyor",
    role: "user"
  },

  // Department MEP
  {
    email: "n.randy@cambodiacpm.com",
    name: "RANDY D. NAKILA",
    position: "MEP Manager",
    department: "MEP",
    role: "user"
  },
  {
    email: "a.gacuya@cambodiacpm.com",
    name: "GACUYA ARNEL",
    position: "MEP Manager",
    department: "MEP",
    role: "user"
  },
  {
    email: "v.phearak@cambodiacpm.com",
    name: "VIN PHEARAK",
    position: "Mechanical Engineer",
    department: "MEP",
    role: "user"
  },
  {
    email: "s.kimleang@cambodiacpm.com",
    name: "SENG KIMLEANG",
    position: "Electrical Engineer",
    department: "MEP",
    role: "user"
  },
  {
    email: "s.randy@cambodiacpm.com",
    name: "SOPHAL NILRANDY",
    position: "Assistant Electrical Engineer",
    department: "MEP",
    role: "user"
  },
  {
    email: "s.sarak@cambodiacpm.com",
    name: "SOK SARAK",
    position: "Electrical Engineer",
    department: "MEP",
    role: "user"
  },
  {
    email: "s.nireth@cambodiacpm.com",
    name: "SOTH MUNIRETH",
    position: "Plumbing Design Engineer",
    department: "MEP",
    role: "user"
  },

  // Department Site Engineer
  {
    email: "o.milko@cambodiacpm.com",
    name: "ORECCHIA MILKO",
    position: "Project Manager",
    department: "Site Engineer",
    role: "user"
  },
  {
    email: "phearum.r@cambodiacpm.com",
    name: "RUN PHEARUM",
    position: "Safety Engineer",
    department: "Site Engineer",
    role: "user"
  },
  {
    email: "h.sopheak@cambodiacpm.com",
    name: "HANN SOPHEAK",
    position: "Site Engineer",
    department: "Site Engineer",
    role: "user"
  },
  {
    email: "l.boribo@cambodiacpm.com",
    name: "LACH BORIBO",
    position: "QA/QC Engineer",
    department: "Site Engineer",
    role: "user"
  },
  {
    email: "c.vetou@cambodiacpm.com",
    name: "CHAOVEY VETOU",
    position: "Site Engineer",
    department: "Site Engineer",
    role: "user"
  },
  {
    email: "p.prun@cambodiacpm.com",
    name: "PECH PHEARUN",
    position: "MEP Site Engineer",
    department: "Site Engineer",
    role: "user"
  },
  {
    email: "v.leheang@cambodiacpm.com",
    name: "VA LEHEANG",
    position: "MEP Site Engineer",
    department: "Site Engineer",
    role: "user"
  },
  {
    email: "s.ramon@cambodiacpm.com",
    name: "SEA RAMON",
    position: "MEP Site Engineer",
    department: "Site Engineer",
    role: "user"
  },

  // Department Marketing (MK)
  {
    email: "t.sina@cambodiacpm.com",
    name: "THONG SINA",
    position: "Marketing Manager",
    department: "Marketing",
    role: "user"
  },
  {
    email: "k.reak@cambodiacpm.com",
    name: "KHAN SOKTHEAREAK",
    position: "Business Development",
    department: "Marketing",
    role: "user"
  },
  {
    email: "test1@cambodiacpm.com",
    name: "User Test1",
    position: "Marketing Manager",
    department: "Marketing",
    role: "user"
  },
  {
    email: "test2@cambodiacpm.com",
    name: "User Test2",
    position: "Business Development",
    department: "Marketing",
    role: "user"
  }
];

// Helper function to find employee by email
const findEmployeeByEmail = (email) => {
  return employees.find(emp => emp.email.toLowerCase() === email.toLowerCase());
};

// Helper function to get all employees
const getAllEmployees = () => {
  return employees;
};

// Helper function to get employees by department
const getEmployeesByDepartment = (department) => {
  return employees.filter(emp => emp.department === department);
};

module.exports = {
  employees,
  findEmployeeByEmail,
  getAllEmployees,
  getEmployeesByDepartment
};
