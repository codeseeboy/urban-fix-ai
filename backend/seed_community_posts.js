require('dotenv').config();
const fs = require('fs');
const path = require('path');
const supabase = require('./config/supabase');

async function main() {
  const assetsDir = path.join(__dirname, '..', 'frontend', 'assets');
  const uploadsDir = path.join(__dirname, 'public', 'uploads');

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const allAssets = fs
    .readdirSync(assetsDir)
    .filter((name) => /\.(jpg|jpeg|png|webp|avif)$/i.test(name))
    .filter((name) => !name.includes("'"));

  if (allAssets.length === 0) {
    throw new Error('No usable image assets found in frontend/assets');
  }

  for (const fileName of allAssets) {
    fs.copyFileSync(path.join(assetsDir, fileName), path.join(uploadsDir, fileName));
  }

  let { data: citizens, error: citizensError } = await supabase
    .from('users')
    .select('id,name,role')
    .eq('role', 'citizen')
    .limit(1);

  if (citizensError) throw citizensError;

  let user = citizens?.[0] || null;
  if (!user) {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id,name,role')
      .limit(1);
    if (usersError) throw usersError;
    user = users?.[0] || null;
  }

  if (!user) throw new Error('No users found to assign community posts');

  const imagePool = allAssets.map((name) => `/public/uploads/${name}`);

  const baseItems = [
    { title: 'Large pothole near market junction', description: 'Deep pothole causing unsafe driving and sudden braking during peak traffic.', category: 'roads', departmentTag: 'Roads', aiSeverity: 'High', emergency: false, address: 'Market Road Junction, Ward 3', lon: 72.8460, lat: 19.1201 },
    { title: 'Streetlight not working on main lane', description: 'Entire lane remains dark after 8 PM, increasing safety concerns for pedestrians.', category: 'lighting', departmentTag: 'Electricity', aiSeverity: 'Medium', emergency: false, address: 'Main Lane, Ward 5', lon: 72.8472, lat: 19.1210 },
    { title: 'Garbage pile overflow near bus stop', description: 'Garbage has accumulated for multiple days and is spilling onto the road.', category: 'trash', departmentTag: 'Sanitation', aiSeverity: 'High', emergency: false, address: 'Central Bus Stop, Ward 2', lon: 72.8451, lat: 19.1193 },
    { title: 'Water pipe leakage wasting clean water', description: 'Continuous leakage from pipeline resulting in waterlogging and wastage.', category: 'water', departmentTag: 'Water', aiSeverity: 'High', emergency: false, address: 'Shanti Nagar Street, Ward 6', lon: 72.8481, lat: 19.1224 },
    { title: 'Broken footpath slabs near school', description: 'Footpath slabs are damaged, making it risky for children and elderly.', category: 'parks', departmentTag: 'Public Works', aiSeverity: 'Medium', emergency: false, address: 'School Road, Ward 4', lon: 72.8443, lat: 19.1186 },
    { title: 'Road edge collapsed after rain', description: 'Road shoulder has collapsed creating a dangerous drop on one side.', category: 'roads', departmentTag: 'Roads', aiSeverity: 'Critical', emergency: true, address: 'Canal Road, Ward 7', lon: 72.8490, lat: 19.1232 },
    { title: 'Flickering streetlight at crossing', description: 'Streetlight keeps flickering and often turns off completely at night.', category: 'lighting', departmentTag: 'Electricity', aiSeverity: 'Medium', emergency: false, address: 'Temple Crossing, Ward 1', lon: 72.8429, lat: 19.1175 },
    { title: 'Illegal dumping behind community hall', description: 'Mixed waste dumped behind hall attracting stray animals and foul smell.', category: 'trash', departmentTag: 'Sanitation', aiSeverity: 'High', emergency: false, address: 'Community Hall Backside, Ward 8', lon: 72.8503, lat: 19.1240 },
    { title: 'Low water pressure in morning hours', description: 'Households are receiving weak water pressure between 6 AM and 9 AM.', category: 'water', departmentTag: 'Water', aiSeverity: 'Medium', emergency: false, address: 'Green Park Colony, Ward 9', lon: 72.8512, lat: 19.1251 },
    { title: 'Damaged walkway near public garden', description: 'Walkway tiles are uneven and broken causing frequent trips and falls.', category: 'parks', departmentTag: 'Parks', aiSeverity: 'Low', emergency: false, address: 'Public Garden Entrance, Ward 10', lon: 72.8520, lat: 19.1260 },
  ];

  const rows = baseItems.map((item, idx) => ({
    user_id: user.id,
    author_type: 'User',
    municipal_page_id: null,
    official_update_type: null,
    title: item.title,
    description: item.description,
    image: imagePool[idx % imagePool.length],
    video: null,
    location_address: item.address,
    location_longitude: item.lon,
    location_latitude: item.lat,
    department_tag: item.departmentTag,
    status: 'Submitted',
    category: item.category,
    priority_score: Math.min(95, 40 + idx * 5),
    ai_severity: item.aiSeverity,
    ai_tags: [item.category, 'community'],
    anonymous: false,
    emergency: item.emergency,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('issues')
    .insert(rows)
    .select('id,title');

  if (insertError) throw insertError;

  for (const issue of inserted || []) {
    await supabase.from('status_timeline').insert({
      issue_id: issue.id,
      status: 'Submitted',
      comment: 'Issue reported by citizen',
    });
  }

  const { count: communityCount } = await supabase
    .from('issues')
    .select('id', { count: 'exact', head: true })
    .eq('author_type', 'User');

  const { count: municipalCount } = await supabase
    .from('issues')
    .select('id', { count: 'exact', head: true })
    .eq('author_type', 'MunicipalPage');

  console.log('Seeded community posts:', inserted?.length || 0);
  console.log('Community total:', communityCount || 0);
  console.log('Municipal total:', municipalCount || 0);
  console.log(`Assigned user: ${user.name} (${user.role})`);
}

main().catch((err) => {
  console.error('Seed failed:', err.message || err);
  process.exit(1);
});
