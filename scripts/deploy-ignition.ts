#!/usr/bin/env node

/**
 * Deployment script demonstrating the use of Hardhat Ignition modules
 * for the Factoring Finance project
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runCommand(command: string, description: string): Promise<void> {
  console.log(`\n🚀 ${description}`);
  console.log(`Command: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command);

    if (stdout) {
      console.log(stdout);
    }

    if (stderr && !stderr.includes('WARNING')) {
      console.error('Error:', stderr);
    }
  } catch (error) {
    console.error(`Failed to execute: ${command}`);
    console.error(error);
    process.exit(1);
  }
}

async function main() {
  console.log('🏭 Factoring Finance Deployment Scripts');
  console.log('======================================');

  console.log('\nAvailable deployment modules:');
  console.log('1. MockUSDCModule - Deploy only MockUSDC token');
  console.log('2. MockUSDTModule - Deploy only MockUSDT token');
  console.log('3. FactoringModule - Basic factoring contract with mock tokens');
  console.log('4. SimpleFundModule - Solo investor fund with auto-offering');
  console.log('5. FundModule - Multi-investor fund with pooled capital');

  const args = process.argv.slice(2);
  const module = args[0];
  const network = args[1] || 'hardhat';

  if (!module) {
    console.log('\nUsage:');
    console.log('  npm run deploy-ignition mock-usdc [network]');
    console.log('  npm run deploy-ignition mock-usdt [network]');
    console.log('  npm run deploy-ignition factoring [network]');
    console.log('  npm run deploy-ignition simple-fund [network]');
    console.log('  npm run deploy-ignition fund [network]');
    console.log('\nExample:');
    console.log('  npm run deploy-ignition mock-usdc localhost');
    console.log('  npm run deploy-ignition factoring localhost');
    console.log('  npm run deploy-ignition simple-fund sepolia');
    return;
  }

  let modulePath: string;

  switch (module.toLowerCase()) {
    case 'mock-usdc':
      modulePath = 'ignition/modules/MockUSDCModule.ts';
      break;
    case 'mock-usdt':
      modulePath = 'ignition/modules/MockUSDTModule.ts';
      break;
    case 'factoring':
      modulePath = 'ignition/modules/FactoringModule.ts';
      break;
    case 'simple-fund':
      modulePath = 'ignition/modules/SimpleFundModule.ts';
      break;
    case 'fund':
      modulePath = 'ignition/modules/FundModule.ts';
      break;
    default:
      console.error(`❌ Unknown module: ${module}`);
      console.log('Available modules: mock-usdc, mock-usdt, factoring, simple-fund, fund');
      process.exit(1);
  }

  await runCommand(
    `npx hardhat ignition deploy ${modulePath} --network ${network}`,
    `Deploying ${module} module to ${network} network`
  );

  console.log('\n✅ Deployment completed successfully!');

  if (network === 'hardhat') {
    console.log('\n⚠️  Note: You deployed to the hardhat network.');
    console.log('   The contracts will be destroyed when the process ends.');
    console.log('   Use --network localhost or another network for persistent deployments.');
  }
}

main().catch((error) => {
  console.error('Deployment failed:', error);
  process.exit(1);
});
