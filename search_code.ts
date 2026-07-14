import fs from 'fs';
import path from 'path';

function searchDirectory(dir: string, term: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDirectory(fullPath, term);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.json')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes(term)) {
        console.log(`Found '${term}' in: ${fullPath}`);
      }
    }
  }
}

console.log("Searching codebase...");
searchDirectory('./src', 'getOrCreateUserId');
searchDirectory('./src', 'localStorage');
