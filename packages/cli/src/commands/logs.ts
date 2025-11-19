import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';
import { showCommandHelp } from './help';

export function handleLogsCommand(args: string[]): void {
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    showCommandHelp('logs');
    return;
  }
  
  const follow = args.includes('--follow') || args.includes('-f');
  const service = args.find(arg => !arg.startsWith('-') && arg !== 'logs');
  
  try {
    const currentDir = cwd();
    const composePath = join(currentDir, 'docker-compose.yml');
    
    if (!existsSync(composePath)) {
      console.error('Error: docker-compose.yml not found');
      console.log('Make sure you are in the core-lane directory');
      process.exit(1);
    }
    
    const followFlag = follow ? '--follow' : '';
    const serviceArg = service ? service : '';
    
    execSync(`docker compose -f ${composePath} logs ${followFlag} ${serviceArg}`, { stdio: 'inherit' });
  } catch (err) {
    console.error('Error viewing logs:', err);
    process.exit(1);
  }
}

