function filterLogMessages(logs) {
  if (!Array.isArray(logs)) return logs;
  const noise = [
    /ComputeBudget111111111111111111111111111111/,
    / success$/,
    / consumed \d+ of \d+ compute units/,
    /^Program 11111111111111111111111111111111 invoke \[\d+\]$/,
    /^Program return:/,
  ];
  return logs
    .filter((line) => !noise.some((re) => re.test(line)))
    .map((line) => {
      // Remove leading 'Program ' and trailing ' invoke [n]'
      line = line
        .replace(/^Program\s+/, "")
        .replace(/\s+invoke\s+\[\d+\]$/, "");
      // Normalize 'Program log: ' prefix to just the message
      line = line.replace(/^Program log:\s+/, "");
      // Remove 'log: Instruction: ' prefix
      line = line.replace(/^log: Instruction:\s+/, "");
      return line;
    });
}

async function filterPoolSignatures(transactionDetails) {
  const logMessages = transactionDetails.meta.logMessages;
  const filteredLogs = filterLogMessages(logMessages);
  // Check if InitializeMint2 appears in log messages
  const foundMintStatus = filteredLogs.some(
    (log) =>
      log.toLowerCase().includes("initializemint2") ||
      log.includes("InitializeMint2") ||
      log.includes("InitializeVirtualPoolWithToken2022") ||
      log.toLowerCase().includes("initializevirtualpoolwithtoken2022")
  );

  return foundMintStatus;
}

async function parseTransaction(transactionSignature, connectionInstance) {
  try {
    let mintAddress;

    const transactionDetails = await connectionInstance.getParsedTransaction(
      transactionSignature,
      {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      }
    );

    const foundMintStatus = await filterPoolSignatures(transactionDetails);
    const innerInstructions = transactionDetails.meta.innerInstructions;

    // Track mint creation
    if (foundMintStatus) {
      innerInstructions.forEach((innerGroup) => {
        innerGroup.instructions
          .filter((instruction) => instruction.program !== undefined)
          .forEach((instruction) => {
            // Extract mint address when initializeMint2 is detected
            if (
              instruction.parsed &&
              instruction.parsed.type === "initializeMint2"
            ) {
              mintAddress = instruction.parsed.info.mint;
            }
          });
      });
      return { status: true, mintAddress: mintAddress };
    } else {
      return { status: false, mintAddress: undefined };
    }
  } catch (error) {
    console.error(`Error parsing transaction: ${error.name}`);
  }
}

export default parseTransaction;
