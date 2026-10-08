// Run from the pocketpay-sdk checkout root: npx tsx /path/to/probe307.ts
// Prints validateAmount's result / error code / validation reason per input.
(async () => {
  const { validateAmount } = await import(process.cwd() + '/src/utils/index.ts');
  const inputs = ['1', '0.0000001', '0', '0.0000000', '10abc', '', '  10  ', '1e3', '-1', '1.12345678',
    '0.00000000', '922337203685.4775807', '922337203685.4775808', '922337203686',
    '922337203686.12345678', '99999999999999999999'];
  for (const v of inputs) {
    try {
      console.log(JSON.stringify(v).padEnd(26), 'ok', validateAmount(v));
    } catch (e: any) {
      console.log(JSON.stringify(v).padEnd(26), e.code, e.validation?.reason ?? '');
    }
  }
})();
