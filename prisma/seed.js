const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

  // Create sample subjects
    const subjects = [
        {
        code: 'IF1101',
        name: 'Dasar Pemrograman',
        description: 'Mata kuliah yang membahas konsep dasar pemrograman',
        semester: 1,
        credits: 3
        },
        {
        code: 'IF1102', 
        name: 'Matematika Diskrit',
        description: 'Mata kuliah yang membahas konsep matematika diskrit',
        semester: 1,
        credits: 3
        },
        {
        code: 'IF2201',
        name: 'Struktur Data dan Algoritma', 
        description: 'Mata kuliah yang membahas struktur data dan algoritma',
        semester: 3,
        credits: 4
        }
    ];

    console.log('📚 Creating subjects...');
    for (const subject of subjects) {
        await prisma.subject.upsert({
        where: { code: subject.code },
        update: {},
        create: subject
        });
    }

    console.log('✅ Subjects created successfully!');
    console.log('📝 Admin users will be created automatically on first Google OAuth login');
    console.log('🌱 Seed completed!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });