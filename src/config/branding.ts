// Single place for DYCI brand assets and tokens.
// Each asset tries the local file in /public/branding first, then the public URL on dyci.edu.ph.
const REMOTE = 'https://dyci.edu.ph';

export const BRAND = {
  institution: "Dr. Yanga's Colleges, Inc.",
  institutionShort: 'DYCI',
  system: 'PASS',
  systemLong: 'Parking Access and Space Management System',
  website: 'https://dyci.edu.ph',
  location: 'Bulacan, Philippines',
  // Verify these against the official brand guide.
  colors: { navy: '#080677', sky: '#96D1F2', gold: '#D4A72C' },
  logoWhite: ['/branding/dyci-logo-white.webp', `${REMOTE}/assets/logo/dyci-logo-with-text-white.webp`],
  logoColor: ['/branding/dyci-logo.png', `${REMOTE}/dyci-logo.png`],
  banner: ['/branding/campus-banner.jpg', `${REMOTE}/assets/banners/lwu2.jpg`],
} as const;
