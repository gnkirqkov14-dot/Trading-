# Формат на "решение" (Decision JSON)

Всяко решение на агента — независимо дали резултатът е `buy`, `sell` или
`hold` — се записва в тази форма. Кодовият източник на истината е
`app/schemas.py` (`DecisionOut` + вложените модели) и ORM моделът
`Decision` в `app/models.py`; този документ е човешко-четимата справка.

## Пример

```json
{
  "id": 42,
  "timestamp": "2026-09-02T14:05:11.203Z",
  "symbol": "BTC",
  "asset_type": "crypto",
  "action": "buy",
  "size_pct_of_portfolio": 0.083,
  "confidence": 0.62,
  "reasoning": "Комбиниран сигнал за BTC: +0.31 (новини +0.42, изказвания -0.10, технически +0.55). RSI14 е 28.4 — актив в зона на препродаденост близо до подкрепа. Водеща новина: \"Bitcoin ETF inflows hit multi-week high\" (сентимент +0.6), частично неутрализирана от предпазливо изказване на SEC председателя. Техническата картина и положителният новинарски поток надделяват над регулаторната несигурност — агентът отваря позиция с умерен размер, отразяващ смесените сигнали.",
  "signals_used": {
    "news": [
      {
        "headline": "Bitcoin ETF inflows hit multi-week high as institutions rotate back into crypto",
        "source": "mock-financial-wire",
        "published_at": "2026-09-02T14:00:00Z",
        "sentiment": 0.6,
        "relevance": 0.95
      }
    ],
    "statements": [
      {
        "speaker": "SEC Chair",
        "statement": "Reiterated caution on spot crypto products pending further review",
        "tone": -0.3,
        "importance": 0.8,
        "timestamp": "2026-09-02T13:40:00Z"
      }
    ],
    "technical": {
      "source": "coingecko",
      "last_price": 61245.12,
      "sma20": 60110.4,
      "sma50": 58890.2,
      "trend": "bullish",
      "rsi14": 28.4,
      "macd": { "macd": 412.3, "signal": 300.1, "histogram": 112.2 },
      "support": 59800.0,
      "resistance": 63200.0,
      "as_of": "2026-09-02T14:05:00Z"
    },
    "scores": {
      "news_sentiment": 0.6,
      "statement_tone": -0.3,
      "technical_score": 0.55,
      "combined_score": 0.31
    }
  },
  "risk": {
    "stop_loss_pct": 0.08,
    "take_profit_pct": 0.2
  },
  "requires_approval": false,
  "executed": true,
  "execution_note": "Купени 0.068 BTC @ 61245.12 ($4164.67)."
}
```

## Полета

| Поле | Тип | Описание |
|---|---|---|
| `symbol` / `asset_type` | string | Тикер и клас на актива (`crypto` \| `etf`) |
| `action` | string | `buy` \| `sell` \| `hold` — крайното решение |
| `size_pct_of_portfolio` | float 0-1 | За `buy`: целеви дял от общата стойност на портфейла за новата/увеличена позиция, ограничен от `max_position_pct`. За `sell` демото прави пълно затваряне на позицията (стойността е 1.0 условно). |
| `confidence` | float 0-1 | `min(1, |combined_score|)` — доверие в решението, извлечено директно от силата на претегления сигнал |
| `reasoning` | string | Естествено-езикова обосновка — от Claude (претегля противоречивите сигнали) или детерминиран rule-based шаблон, ако няма LLM ключ |
| `signals_used.news` / `.statements` | list | Суровите новини/изказвания, използвани в тази обосновка, всяка тагната със sentiment/tone (-1..1) и relevance/importance (0..1) |
| `signals_used.technical` | object | SMA20/50, RSI14, MACD, support/resistance, извор на данните (`coingecko` \| `stooq` \| `synthetic_fallback`) |
| `signals_used.scores` | object | Междинните претеглени резултати преди крайния `combined_score`, за прозрачност/дебъг |
| `risk.stop_loss_pct` / `risk.take_profit_pct` | float | Приложени към позицията при изпълнение; проверяват се на всеки следващ pipeline цикъл |
| `requires_approval` | bool | `True`, когато `autonomous_mode = false` и размерът на позицията е над `approval_threshold_pct` — вижте ARCHITECTURE.md, т.4 |
| `executed` | bool | Дали решението реално е довело до сделка (буквално `false` за "hold" по действие, но `executed=true` семантично значи "обработено докрай", вижте `execution_note`) |
| `execution_note` | string | Човешко-четим резултат от изпълнението (сума, количество, причина за отказ, чакане на одобрение и т.н.) |

## Тегла зад `combined_score`

`app/modules/decision_engine.py`:

```
combined_score = news_sentiment * 0.35 + statement_tone * 0.25 + technical_score * 0.40
```

- `|combined_score| < 0.18` → `hold`
- `combined_score >= 0.18` → `buy`
- `combined_score <= -0.18` **и** има отворена позиция → `sell`

Тези тегла и прагът са константи в началото на файла — лесни за
експериментиране/бектестване, без промяна на останалата логика.
