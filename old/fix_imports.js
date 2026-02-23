
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve('./src');

function walk(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walk(filePath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            let content = fs.readFileSync(filePath, 'utf8');
            let changed = false;

            // Replace standard imports: import ... from "pkg@1.2.3"
            const importRegex = /from\s+['"]([^'"]+)@\d+\.\d+\.\d+['"]/g;
            if (importRegex.test(content)) {
                content = content.replace(importRegex, (match, pkg) => {
                    return `from "${pkg}"`;
                });
                changed = true;
            }

            // Replace dynamic imports: import("pkg@1.2.3")
            const dynamicRegex = /import\(\s*['"]([^'"]+)@\d+\.\d+\.\d+['"]\s*\)/g;
            if (dynamicRegex.test(content)) {
                content = content.replace(dynamicRegex, (match, pkg) => {
                    return `import("${pkg}")`;
                });
                changed = true;
            }

            if (changed) {
                console.log(`Fixed: ${filePath}`);
                fs.writeFileSync(filePath, content);
            }
        }
    });
}

console.log('Starting import fix...');
walk(rootDir);
console.log('Import fix complete.');
