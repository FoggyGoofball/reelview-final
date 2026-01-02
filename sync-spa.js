const fs = require('fs-extra');
const path = require('path');

const spaDistPath = path.join(__dirname, 'dist');
const wwwPath = path.join(__dirname, 'www');

async function syncSPA() {
  try {
    if (!fs.existsSync(spaDistPath)) {
      console.log('Building SPA first...');
      require('child_process').execSync('npm run build', { stdio: 'inherit' });
    }

    console.log('Syncing SPA to www/...');
    await fs.remove(wwwPath);
    await fs.copy(spaDistPath, wwwPath);
    console.log('? SPA synced to www/ successfully');
  } catch (error) {
    console.error('Failed to sync SPA:', error.message);
    process.exit(1);
  }
}

syncSPA();
