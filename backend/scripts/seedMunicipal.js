const axios = require('axios');

const BASE = 'http://localhost:5000/api';

async function main() {
  console.log('Logging in as admin...');
  const loginRes = await axios.post(BASE + '/auth/login', {
    email: 'admin@urbanfix.com',
    password: 'admin123',
  });
  const token = loginRes.data.token;
  console.log('Admin logged in successfully.\n');

  const headers = { Authorization: 'Bearer ' + token };

  const municipalPages = [
    {
      name: 'Boisar Municipal Council',
      handle: 'boisar-municipal',
      department: 'General',
      description: 'Official municipal page for Boisar town. Managing civic infrastructure, sanitation, water supply, roads, and public services for Boisar residents.',
      region: { city: 'Boisar', state: 'Maharashtra', district: 'Palghar' },
    },
    {
      name: 'Palghar Municipal Council',
      handle: 'palghar-municipal',
      department: 'General',
      description: 'Official municipal page for Palghar. Overseeing urban development, public health, waste management, and civic amenities for Palghar district headquarters.',
      region: { city: 'Palghar', state: 'Maharashtra', district: 'Palghar' },
    },
    {
      name: 'Virar Municipal Corporation',
      handle: 'virar-municipal',
      department: 'General',
      description: 'Official municipal corporation page for Virar. Managing large-scale urban infrastructure, transportation, water supply, and civic services for Vasai-Virar residents.',
      region: { city: 'Virar', state: 'Maharashtra', district: 'Palghar' },
    },
  ];

  const pageIds = {};

  for (const pg of municipalPages) {
    try {
      const res = await axios.post(BASE + '/municipal/create', pg, { headers });
      pageIds[pg.handle] = res.data._id || res.data.id;
      console.log('Created: ' + pg.name + ' (ID: ' + pageIds[pg.handle] + ')');
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log('Page "' + pg.name + '" already exists, fetching...');
        const searchRes = await axios.get(BASE + '/municipal/search?q=' + pg.handle, { headers });
        const found = searchRes.data.find(function(p) { return p.handle === pg.handle; });
        if (found) {
          pageIds[pg.handle] = found._id || found.id;
          console.log('Found existing: ' + pg.name + ' (ID: ' + pageIds[pg.handle] + ')');
        }
      } else {
        console.error('Error creating ' + pg.name + ':', err.response ? err.response.data : err.message);
      }
    }
  }

  console.log('\nPage IDs:', pageIds, '\n');

  var allPosts = {};

  allPosts['boisar-municipal'] = [
    {
      title: 'Boisar Water Supply Schedule Updated',
      description: 'Dear residents, the water supply schedule for Boisar has been revised effective from 15th March 2026. Ward A & B: 6:00 AM - 9:00 AM, Ward C & D: 10:00 AM - 1:00 PM, Ward E & F: 3:00 PM - 6:00 PM. Please store water accordingly. Tanker services available for emergencies at helpline 1800-XXX-XXXX.',
      officialUpdateType: 'Announcement',
      location: { address: 'Boisar, Palghar, Maharashtra', coordinates: [72.7567, 19.8014] },
    },
    {
      title: 'Road Repair Work on NH-8 Boisar Stretch',
      description: 'We are undertaking major road repair work on the NH-8 stretch passing through Boisar from 16th March to 30th March 2026. Traffic will be diverted via the internal bypass road near Boisar Railway Station. We apologize for the inconvenience and request residents to plan their commute accordingly.',
      officialUpdateType: 'Notice',
      location: { address: 'NH-8, Boisar, Maharashtra', coordinates: [72.7590, 19.8050] },
    },
    {
      title: 'Free Health Camp at Boisar Community Hall',
      description: 'Boisar Municipal Council in association with Government Hospital Boisar is organizing a free health checkup camp on 20th March 2026 at the Community Hall. Services include blood pressure check, blood sugar test, eye checkup, dental screening, and general physician consultation. Bring your Aadhaar card. Timings: 9 AM to 4 PM.',
      officialUpdateType: 'Announcement',
      location: { address: 'Community Hall, Boisar, Maharashtra', coordinates: [72.7580, 19.8000] },
    },
    {
      title: 'Property Tax Payment Deadline Extended',
      description: 'Notice to all property owners in Boisar: The deadline for property tax payment for FY 2025-26 has been extended to 31st March 2026. Payments can be made online via the municipal portal or at the BMC office counter. A 2% early payment discount is available until 25th March. Late payment will attract 1.5% monthly penalty.',
      officialUpdateType: 'Notice',
      location: { address: 'BMC Office, Boisar, Maharashtra', coordinates: [72.7560, 19.7990] },
    },
    {
      title: 'New Streetlights Installed in Boisar East',
      description: 'We are pleased to announce that 150 new LED streetlights have been installed across Boisar East covering areas including Shanti Nagar, Ganesh Colony, and Mahavir Nagar. This is part of our Smart Lighting initiative to improve nighttime safety and reduce energy consumption by 40%. Report any non-functional lights via the UrbanFix app.',
      officialUpdateType: 'Announcement',
      location: { address: 'Boisar East, Maharashtra', coordinates: [72.7620, 19.8030] },
    },
  ];

  allPosts['palghar-municipal'] = [
    {
      title: 'Palghar Smart City Project Phase 2 Launched',
      description: 'The Palghar Municipal Council is proud to announce the launch of Phase 2 of the Smart City Project. This phase includes smart traffic management at 15 major junctions, 200 CCTV cameras for public safety, Wi-Fi zones at 5 public spaces, and an integrated command center. Expected completion: September 2026.',
      officialUpdateType: 'Announcement',
      location: { address: 'Palghar, Maharashtra', coordinates: [72.7710, 19.6947] },
    },
    {
      title: 'Monsoon Preparedness Advisory',
      description: 'As monsoon season approaches, Palghar Municipal Council advises all residents to: 1) Clear drainage near your premises, 2) Avoid construction debris on roads, 3) Stock essential medicines, 4) Keep emergency numbers handy. Low-lying area residents should prepare for possible relocation to designated shelters.',
      officialUpdateType: 'Notice',
      location: { address: 'Palghar, Maharashtra', coordinates: [72.7700, 19.6960] },
    },
    {
      title: 'New Public Library Opens in Palghar',
      description: 'We are delighted to inaugurate the Palghar District Public Library with over 25,000 books, a digital reading section with 50 computers, dedicated children and senior citizen areas, study rooms for competitive exam aspirants, and free Wi-Fi. Located opposite the Collector Office. Open Monday to Saturday, 8 AM to 8 PM. Membership is free for all Palghar residents.',
      officialUpdateType: 'Announcement',
      location: { address: 'Near Collector Office, Palghar, Maharashtra', coordinates: [72.7680, 19.6940] },
    },
    {
      title: 'Waste Segregation Now Mandatory',
      description: 'Effective 1st April 2026, waste segregation at source is mandatory for all households and commercial establishments in Palghar. Separate your waste into: Green (wet/organic), Blue (dry/recyclable), Red (hazardous). Non-compliance will attract a fine of Rs. 500 for first offense and Rs. 2000 for repeated violations.',
      officialUpdateType: 'Notice',
      location: { address: 'Palghar, Maharashtra', coordinates: [72.7720, 19.6950] },
    },
    {
      title: 'Palghar Marathon 2026 Registration Open',
      description: 'Palghar Municipal Council presents the 3rd Annual Palghar Marathon on 5th April 2026. Categories: Full Marathon (42km), Half Marathon (21km), 10K Run, and 5K Fun Run. Route covers scenic Palghar creek, heritage sites, and new smart city corridor. Prizes worth Rs. 5 lakh. Register on the UrbanFix app or at the municipal office.',
      officialUpdateType: 'Announcement',
      location: { address: 'Palghar Creek Road, Maharashtra', coordinates: [72.7690, 19.6930] },
    },
  ];

  allPosts['virar-municipal'] = [
    {
      title: 'Virar Metro Line Construction Update',
      description: 'Virar Municipal Corporation provides an update on the Virar-Alibaug Metro corridor. The elevated section through Virar West is 65% complete. Pillars have been erected along the 8km stretch from Virar Station to Global City. Expected commissioning of Virar segment: December 2026. We appreciate your patience during construction.',
      officialUpdateType: 'Announcement',
      location: { address: 'Virar West, Maharashtra', coordinates: [72.8119, 19.4559] },
    },
    {
      title: 'Bolinj Beach Cleanup Drive - Volunteers Needed',
      description: 'Virar Municipal Corporation is organizing a massive beach cleanup drive at Bolinj Beach on 22nd March 2026. We need 500 volunteers! Free refreshments and certificate of appreciation for all participants. Gloves, bags, and equipment will be provided. Report at 6:30 AM at Bolinj Beach parking.',
      officialUpdateType: 'Announcement',
      location: { address: 'Bolinj Beach, Virar, Maharashtra', coordinates: [72.7900, 19.4600] },
    },
    {
      title: 'Traffic Diversion Near Virar Railway Station',
      description: 'Due to ongoing flyover construction near Virar Railway Station, traffic from the east side will be diverted via Phoolpada Road from 18th March to 15th May 2026. Heavy vehicles are prohibited between 7 AM and 10 PM. Additional traffic police will be deployed. Please use the Virar West approach for station access during this period.',
      officialUpdateType: 'Notice',
      location: { address: 'Virar Railway Station, Maharashtra', coordinates: [72.8110, 19.4550] },
    },
    {
      title: 'Free Computer Training for Youth',
      description: 'Virar Municipal Corporation launches a free 3-month computer training program for youth aged 18-30. Courses include: MS Office, Tally, Basic Programming, Digital Marketing, and Graphic Design. Classes at the Municipal Digital Center, Global City, Virar. Batch starts 1st April 2026. Limited to 200 seats.',
      officialUpdateType: 'Announcement',
      location: { address: 'Global City, Virar, Maharashtra', coordinates: [72.8150, 19.4580] },
    },
    {
      title: 'Water Pipeline Maintenance - Supply Disruption',
      description: 'Notice: Due to scheduled maintenance of the 900mm main water pipeline at Virar East, water supply will be disrupted on 19th March 2026 from 10 PM to 6 AM (next day). Affected areas: Virar East, Agashi, Dongarpada, and Bolinj. Residents are advised to store sufficient water. Emergency tanker requests: 02502-XXXXXX.',
      officialUpdateType: 'Notice',
      location: { address: 'Virar East, Maharashtra', coordinates: [72.8200, 19.4570] },
    },
  ];

  var totalPosts = 0;
  var handles = ['boisar-municipal', 'palghar-municipal', 'virar-municipal'];

  for (var h = 0; h < handles.length; h++) {
    var handle = handles[h];
    var posts = allPosts[handle];
    var pageId = pageIds[handle];

    if (!pageId) {
      console.error('No page ID for ' + handle + ', skipping posts.');
      continue;
    }

    console.log('Creating posts for ' + handle + ' (' + pageId + '):');
    for (var p = 0; p < posts.length; p++) {
      var post = posts[p];
      try {
        var res = await axios.post(BASE + '/municipal/' + pageId + '/post', post, { headers: headers });
        console.log('  [' + post.officialUpdateType + '] ' + post.title + ' - OK');
        totalPosts++;
      } catch (err) {
        console.error('  FAILED: ' + post.title + ' -', err.response ? err.response.data : err.message);
      }
    }
    console.log('');
  }

  console.log('=== DONE ===');
  console.log('Created 3 municipal pages and ' + totalPosts + ' posts/notices/announcements.');
}

main().catch(function(err) {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
