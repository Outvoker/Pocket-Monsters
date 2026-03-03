const https = require('https');
const fs = require('fs');
const path = require('path');

const POKEMON_DATA = {
  fire: [
    { id: 4 }, { id: 37 }, { id: 58 }, { id: 77 }, { id: 5 }, { id: 126 },
    { id: 38 }, { id: 78 }, { id: 136 }, { id: 59 }, { id: 146 }, { id: 244 }, { id: 6 }
  ],
  water: [
    { id: 129 }, { id: 7 }, { id: 54 }, { id: 60 }, { id: 79 }, { id: 118 },
    { id: 72 }, { id: 8 }, { id: 121 }, { id: 134 }, { id: 131 }, { id: 130 }, { id: 9 }
  ],
  grass: [
    { id: 43 }, { id: 69 }, { id: 46 }, { id: 102 }, { id: 114 }, { id: 1 },
    { id: 44 }, { id: 70 }, { id: 2 }, { id: 103 }, { id: 71 }, { id: 45 }, { id: 3 }
  ],
  electric: [
    { id: 100 }, { id: 81 }, { id: 82 }, { id: 25 }, { id: 101 }, { id: 125 },
    { id: 26 }, { id: 135 }, { id: 181 }, { id: 405 }, { id: 466 }, { id: 243 }, { id: 145 }
  ]
};

const outputDir = path.join(__dirname, 'public', 'images', 'pokemon');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const allPokemonIds = new Set();
for (const type in POKEMON_DATA) {
  POKEMON_DATA[type].forEach(mon => allPokemonIds.add(mon.id));
}

const pokemonIds = Array.from(allPokemonIds).sort((a, b) => a - b);

console.log(`准备下载 ${pokemonIds.length} 个宝可梦图片...`);

function downloadImage(pokemonId) {
  return new Promise((resolve, reject) => {
    const url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
    const outputPath = path.join(outputDir, `${pokemonId}.png`);

    if (fs.existsSync(outputPath)) {
      console.log(`✓ 跳过 #${pokemonId} (已存在)`);
      resolve();
      return;
    }

    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`下载失败 #${pokemonId}: HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`✓ 下载完成 #${pokemonId}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(new Error(`下载失败 #${pokemonId}: ${err.message}`));
    });

    file.on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function downloadAll() {
  let success = 0;
  let failed = 0;

  for (const id of pokemonIds) {
    try {
      await downloadImage(id);
      success++;
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`✗ ${err.message}`);
      failed++;
    }
  }

  console.log(`\n下载完成！成功: ${success}, 失败: ${failed}`);
}

downloadAll();
