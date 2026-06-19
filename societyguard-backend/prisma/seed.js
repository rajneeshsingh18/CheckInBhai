require('dotenv').config();
const { prismaBase: prisma } = require('../src/config/database');
const bcrypt = require('bcryptjs');

async function main() {
  console.log('Starting database seeding...');

  // --- 1. CLEANUP ---
  console.log('Cleaning up existing data...');
  // Delete in reverse order of dependencies to respect foreign keys
  await prisma.staffAttendance.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.visitorEntry.deleteMany();
  await prisma.visitor.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.sOSAlert.deleteMany();
  await prisma.oTP.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.guard.deleteMany();
  await prisma.resident.deleteMany();
  await prisma.user.deleteMany();
  await prisma.flat.deleteMany();
  await prisma.tower.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.society.deleteMany();

  // Common credentials
  const passwordHash = await bcrypt.hash('Test@123', 10);
  const pinHash = await bcrypt.hash('123456', 10);

  // Collect credentials for output
  const credentials = [];

  // --- 2. SUPER ADMIN ---
  console.log('Creating Super Admin...');
  const superAdmin = await prisma.user.create({
    data: {
      name: 'Vikram Singh',
      email: 'superadmin@rakshak.com',
      mobile: '9876543210',
      passwordHash,
      role: 'SUPER_ADMIN',
      emailVerified: true
    }
  });
  credentials.push({ Role: 'SUPER_ADMIN', Email: superAdmin.email, Password: 'Test@123' });

  // --- 3. SOCIETIES & SUBSCRIPTIONS ---
  const societiesData = [
    {
      name: 'Green Valley Apartments',
      address: 'Sector 42, Golf Course Road',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122002',
      plan: 'STARTER',
      subStatus: 'ACTIVE'
    },
    {
      name: 'Sunshine Heights',
      address: 'Whitefield Main Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560066',
      plan: 'GROWTH',
      subStatus: 'ACTIVE'
    },
    {
      name: 'Premium Towers',
      address: 'Bandra West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      plan: 'ENTERPRISE',
      subStatus: 'TRIALING',
      trialEnds: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    }
  ];

  const createdSocieties = [];

  for (let i = 0; i < societiesData.length; i++) {
    const sData = societiesData[i];
    console.log(`Creating Society: ${sData.name}...`);
    
    const society = await prisma.society.create({
      data: {
        name: sData.name,
        address: sData.address,
        city: sData.city,
        state: sData.state,
        pincode: sData.pincode,
        subscription: {
          create: {
            planType: sData.plan,
            status: sData.subStatus,
            trialEndsAt: sData.trialEnds || null
          }
        }
      }
    });
    createdSocieties.push(society);

    // Create Society Admin
    const prefix = sData.name.split(' ')[0].toLowerCase();
    const adminEmail = `admin@${prefix}.com`;
    const admin = await prisma.user.create({
      data: {
        name: `${sData.name.split(' ')[0]} Admin`,
        email: adminEmail,
        passwordHash,
        role: 'SOCIETY_ADMIN',
        societyId: society.id,
        emailVerified: true
      }
    });
    credentials.push({ Role: 'SOCIETY_ADMIN', Society: sData.name, Email: adminEmail, Password: 'Test@123' });

    // Create 2 Guards
    for (let g = 1; g <= 2; g++) {
      const guardEmail = `guard${g}@${prefix}.com`;
      await prisma.user.create({
        data: {
          name: `Ramesh Guard ${g}`,
          email: guardEmail,
          passwordHash,
          role: 'GUARD',
          societyId: society.id,
          emailVerified: true,
          guard: {
            create: {
              societyId: society.id,
              pinCode: pinHash
            }
          }
        }
      });
      if (g === 1) { // Just log one guard per society
        credentials.push({ Role: 'GUARD', Society: sData.name, Email: guardEmail, PIN: '123456' });
      }
    }

    // Create Towers and Flats
    const towerNames = ['Tower A', 'Tower B'];
    const flatNumbers = ['101', '102', '201', '202'];
    const flatIds = []; // store for operational data

    for (const tName of towerNames) {
      const tower = await prisma.tower.create({
        data: { name: tName, societyId: society.id }
      });

      for (const fNum of flatNumbers) {
        const flat = await prisma.flat.create({
          data: { number: fNum, floor: parseInt(fNum[0]), societyId: society.id, towerId: tower.id }
        });
        flatIds.push(flat.id);

        // Create Resident
        const resEmail = `res_${fNum}_${tName.replace(' ', '')}@${prefix}.com`.toLowerCase();
        await prisma.user.create({
          data: {
            name: `Rahul Resident ${fNum}`,
            email: resEmail,
            mobile: `99887766${fNum.slice(-2)}`,
            passwordHash,
            role: 'RESIDENT',
            societyId: society.id,
            emailVerified: true,
            resident: {
              create: { flatId: flat.id }
            }
          }
        });
        
        // Log just one resident for testing
        if (tName === 'Tower A' && fNum === '101') {
           credentials.push({ Role: 'RESIDENT', Flat: fNum, Society: sData.name, Email: resEmail, Password: 'Test@123' });
        }
      }
    }

    // --- 4. OPERATIONAL DATA ---
    const randomFlat = () => flatIds[Math.floor(Math.random() * flatIds.length)];

    // Green Valley (Heavy Data)
    if (sData.name === 'Green Valley Apartments') {
      console.log('Seeding operational data for Green Valley...');
      
      // 10 Visitors
      for (let v = 1; v <= 10; v++) {
        const visitor = await prisma.visitor.create({
          data: { name: `Visitor ${v}`, mobile: `90000000${v.toString().padStart(2, '0')}` }
        });
        const statuses = ['PENDING', 'APPROVED', 'EXITED', 'REJECTED'];
        await prisma.visitorEntry.create({
          data: {
            visitorId: visitor.id,
            flatId: randomFlat(),
            societyId: society.id,
            purpose: 'Delivery/Meeting',
            status: statuses[v % 4]
          }
        });
      }

      // 5 Deliveries
      const categories = ['Amazon', 'Swiggy', 'Zomato', 'Courier', 'Flipkart'];
      for (let d = 0; d < 5; d++) {
        await prisma.delivery.create({
          data: {
            societyId: society.id,
            flatId: randomFlat(),
            category: categories[d],
            status: d < 2 ? 'RECEIVED' : 'PICKED_UP'
          }
        });
      }

      // 3 Staff
      const staffTypes = ['MAID', 'DRIVER', 'COOK'];
      for (let s = 0; s < 3; s++) {
        const staff = await prisma.staff.create({
          data: {
            name: `Staff Member ${s}`,
            type: staffTypes[s],
            flatId: randomFlat()
          }
        });
        // Attendance
        await prisma.staffAttendance.create({
          data: { staffId: staff.id, flatId: staff.flatId }
        });
      }

      // 5 Vehicles
      for (let v = 1; v <= 5; v++) {
        await prisma.vehicle.create({
          data: {
            number: `HR26DQ${1000 + v}`,
            type: 'Car',
            societyId: society.id,
            flatId: v <= 3 ? randomFlat() : null, // 3 resident, 2 visitor
            isResident: v <= 3
          }
        });
      }

      // 2 SOS Alerts
      const adminUserId = (await prisma.user.findFirst({ where: { role: 'SOCIETY_ADMIN', societyId: society.id }})).id;
      await prisma.sOSAlert.create({
        data: { societyId: society.id, flatId: flatIds[0], type: 'MEDICAL', status: 'ACTIVE', raisedById: adminUserId, location: 'Tower A Lobby' }
      });
      await prisma.sOSAlert.create({
        data: { societyId: society.id, flatId: flatIds[1], type: 'SECURITY', status: 'RESOLVED', raisedById: adminUserId, location: 'Gate 1', resolvedAt: new Date() }
      });
    }

    // Sunshine Heights (Moderate Data)
    if (sData.name === 'Sunshine Heights') {
      for (let v = 1; v <= 5; v++) {
        const visitor = await prisma.visitor.create({ data: { name: `Sun Visitor ${v}`, mobile: `80000000${v.toString().padStart(2, '0')}` }});
        await prisma.visitorEntry.create({ data: { visitorId: visitor.id, flatId: randomFlat(), societyId: society.id, status: 'APPROVED' }});
      }
      for (let d = 0; d < 3; d++) {
        await prisma.delivery.create({ data: { societyId: society.id, flatId: randomFlat(), category: 'Amazon' }});
      }
      await prisma.staff.create({ data: { name: 'Sun Maid', type: 'MAID', flatId: randomFlat() }});
    }

    // Premium Towers (Light Data)
    if (sData.name === 'Premium Towers') {
      for (let v = 1; v <= 3; v++) {
        const visitor = await prisma.visitor.create({ data: { name: `Prem Visitor ${v}`, mobile: `70000000${v.toString().padStart(2, '0')}` }});
        await prisma.visitorEntry.create({ data: { visitorId: visitor.id, flatId: randomFlat(), societyId: society.id }});
      }
      for (let d = 0; d < 2; d++) {
        await prisma.delivery.create({ data: { societyId: society.id, flatId: randomFlat(), category: 'Courier' }});
      }
    }
  }

  console.log('\n--- SEEDING COMPLETE ---');
  console.log('Test Credentials:');
  console.table(credentials);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });