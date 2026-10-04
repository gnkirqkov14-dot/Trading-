/**
 * Тестов „агент“, който плаща за данните за поръчки по x402.
 *
 * Показва целия цикъл в три стъпки, за да се види с очи как работи:
 *   1. Заявка без плащане → 402 + цена.
 *   2. Същата заявка през @x402/fetch, който сам подписва USDC плащане
 *      от тестов портфейл и повтаря заявката.
 *   3. Данните + разписката за сетълмента (хеш на транзакцията).
 *
 * Пускане (от папката tenders-platform):
 *
 *   npm run x402:test -- "https://ВАШИЯТ-САЙТ/api/agent/tenders?category=45&region=BG421"
 *
 * Променливи на средата:
 *   X402_CLIENT_PRIVATE_KEY  — частен ключ на ТЕСТОВ портфейл (0x + 64 знака).
 *                              Без него скриптът спира след стъпка 1 и само
 *                              показва цената. Никога не ползвай портфейла,
 *                              в който получаваш парите, и никога истински
 *                              портфейл с реални средства за тестове.
 *
 * Тестовият портфейл трябва да има малко USDC в мрежата, която сървърът
 * иска (Base Sepolia по подразбиране — безплатно от faucet.circle.com).
 * Газ не му трябва: по EIP-3009 транзакцията я праща посредникът.
 */

import {
  decodePaymentResponseHeader,
  wrapFetchWithPaymentFromConfig,
} from "@x402/fetch";
import { decodePaymentRequiredHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const url = process.argv[2];
if (!url) {
  console.error(
    'Употреба: npm run x402:test -- "https://ВАШИЯТ-САЙТ/api/agent/tenders?limit=3"',
  );
  process.exit(1);
}

const privateKey = process.env.X402_CLIENT_PRIVATE_KEY?.trim();

function usdc(amountAtomic: string, decimals = 6) {
  const n = Number(amountAtomic) / 10 ** decimals;
  return `${n} USDC`;
}

async function main() {
  console.log(`\n① Заявка без плащане: GET ${url}`);
  const first = await fetch(url, { headers: { Accept: "application/json" } });
  console.log(`   → HTTP ${first.status}`);

  if (first.status !== 402) {
    console.log("   Отговор:", (await first.text()).slice(0, 600));
    console.log(
      "\n   Това не е платен адрес (или касата не е включена — виж X402_PAY_TO на сървъра).",
    );
    return;
  }

  const requiredHeader = first.headers.get("PAYMENT-REQUIRED");
  if (requiredHeader) {
    const required = decodePaymentRequiredHeader(requiredHeader);
    for (const option of required.accepts) {
      console.log(
        `   Цена: ${usdc(option.amount)} · мрежа ${option.network} · към ${option.payTo}`,
      );
    }
  } else {
    console.log("   Тяло:", (await first.text()).slice(0, 400));
  }

  if (!privateKey) {
    console.log(
      "\n② Пропуснато: няма X402_CLIENT_PRIVATE_KEY. Задай частен ключ на ТЕСТОВ портфейл, за да видиш и плащането.",
    );
    return;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`\n② Плащам от тестовия портфейл ${account.address} и повтарям заявката…`);

  const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:*", client: new ExactEvmScheme(account) }],
  });

  const paid = await fetchWithPayment(url, {
    headers: { Accept: "application/json" },
  });
  console.log(`   → HTTP ${paid.status}`);

  const body = await paid.text();
  console.log("\n③ Данни (първите 1200 знака):");
  console.log(body.slice(0, 1200));

  const receiptHeader = paid.headers.get("PAYMENT-RESPONSE");
  if (receiptHeader) {
    const receipt = decodePaymentResponseHeader(receiptHeader);
    console.log("\n   Разписка за плащането:");
    console.log(`   успех: ${receipt.success}`);
    if (receipt.transaction) console.log(`   транзакция: ${receipt.transaction}`);
    if (receipt.network) console.log(`   мрежа: ${receipt.network}`);
    if (receipt.errorReason) console.log(`   грешка: ${receipt.errorReason}`);
  }
}

main().catch((error) => {
  console.error("\nГрешка:", error instanceof Error ? error.message : error);
  process.exit(1);
});
