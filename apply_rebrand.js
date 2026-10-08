const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const publicDir = path.join(__dirname, 'public');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  
  replacements.forEach(({from, to}) => {
    newContent = newContent.split(from).join(to);
  });
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

// 1. General string replacements
const generalReplacements = [
  { from: "San Agustin Resort & Homestay Association (MVBA)", to: "Panaw" },
  { from: "San Agustin Resort and Homestay Association (MVBA)", to: "Panaw" },
  { from: "San Agustin Resort & Homestay Association", to: "Panaw" },
  { from: "San Agustin Resort and Homestay Association", to: "Panaw" },
  { from: "MVBA Association Admin", to: "Panaw Admin" },
  { from: "MVBA Association Office", to: "Panaw Office" },
  { from: "MVBA Admin", to: "Panaw Admin" },
  { from: "MVBA Boarding Pass", to: "Panaw Boarding Pass" },
  { from: "MVBA Official Boarding Pass", to: "Panaw Official Boarding Pass" },
  { from: "MVBA PWA", to: "Panaw" },
  { from: "MVBA account", to: "Panaw account" },
  { from: "MVBA platform", to: "Panaw platform" },
  { from: "homestay@mvba.test", to: "homestay@panaw.test" },
  { from: "resort@mvba.test", to: "resort@panaw.test" },
  { from: "admin@mvba.test", to: "admin@panaw.test" },
  { from: "MVBA", to: "Panaw" },
];

walkDir(srcDir, (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    replaceInFile(filePath, generalReplacements);
  }
});

// 2. Metadata / Titles
const metadataReplacements = [
  { from: "title: \"Bretania Travel — Resort & Homestay Bookings\",", to: "title: \"Panaw — book direct sa Britania, San Agustin\"," },
  { from: "title: \"Bretania\",", to: "title: \"Panaw\"," },
  { from: "description:\n    \"Discover and book stays in Bretania, San Agustin, Surigao del Sur. Browse resorts, homestays, island hopping tours, and more.\",", to: "description:\n    \"Panaw — book direct sa Britania, San Agustin\"," },
];
walkDir(srcDir, (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    replaceInFile(filePath, metadataReplacements);
  }
});

// 3. Manifest
const manifestPath = path.join(publicDir, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  replaceInFile(manifestPath, [
    { from: '"name": "Bretania Travel"', to: '"name": "Panaw"' },
    { from: '"short_name": "Bretania"', to: '"short_name": "Panaw"' },
    { from: '"description": "Bretania Stays and Tours"', to: '"description": "Panaw — book direct sa Britania, San Agustin"' },
  ]);
}

console.log("Done rebranding script.");
