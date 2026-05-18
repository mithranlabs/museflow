import fs from 'fs';
import path from 'path';

export class HindsightMemory {
  private storagePath: string;

  constructor(userId: string) {
    this.storagePath = path.join(process.cwd(), 'artifacts', 'memory', `${userId}.json`);
    if (!fs.existsSync(path.dirname(this.storagePath))) {
      fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
    }
  }

  getPreferences(): any {
    if (fs.existsSync(this.storagePath)) {
      return JSON.parse(fs.readFileSync(this.storagePath, 'utf-8'));
    }
    return {
      preferredGenres: [],
      favoriteImagery: [],
      vocalPreferences: [],
      dislikedStyles: []
    };
  }

  updateMemory(newInsights: any) {
    const current = this.getPreferences();
    const updated = { ...current, ...newInsights };
    fs.writeFileSync(this.storagePath, JSON.stringify(updated, null, 2));
    return updated;
  }
}
