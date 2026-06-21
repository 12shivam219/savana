import fs from 'fs';
import path from 'path';

const keywords = ['postgres://', 'postgresql://', 'db_password', 'db_user', 'db_host', 'supabase-db', 'db.supabase.co'];

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        searchDir(fullPath);
      }
    } else {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const kw of keywords) {
        if (content.includes(kw)) {
          console.log(`Found "${kw}" in file: ${fullPath}`);
        }
      }
    }
  }
}

searchDir('.');
