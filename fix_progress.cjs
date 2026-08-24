const fs = require('fs');
let code = fs.readFileSync('src/main.ts', 'utf8');

// Fix Phase 1 scaling
code = code.replace(
    /fileObj\.aiProgress = Math\.round\(\(completedCount \/ totalChunks\) \* 100\);/g,
    'fileObj.aiProgress = Math.round((completedCount / totalChunks) * 80);'
);

// Add Phase 2 (Border Review)
const target2 = `} catch (err: any) {
          log(\`[\${fileObj.name}][\${contextLabel}] Frontera \${i + 1}: fallback seguro (sin cambios) por error de agente: \${err.message}\`, 'warning');
        }
      }`;

const newTarget2 = `} catch (err: any) {
          log(\`[\${fileObj.name}][\${contextLabel}] Frontera \${i + 1}: fallback seguro (sin cambios) por error de agente: \${err.message}\`, 'warning');
        }
        
        fileObj.aiProgress = 80 + Math.round(((i + 1) / totalBoundaries) * 5);
        renderFileCard(fileObj);
      }`;
code = code.replace(target2, newTarget2);

// Add Phase 3 (AI Spell Check)
const target3 = `}
          correctedChunks.push(resObj.text);
        }`;

const newTarget3 = `}
          correctedChunks.push(resObj.text);
          fileObj.aiProgress = 85 + Math.round(((i + 1) / chunks.length) * 14);
          renderFileCard(fileObj);
        }`;
code = code.replace(target3, newTarget3);

fs.writeFileSync('src/main.ts', code);
