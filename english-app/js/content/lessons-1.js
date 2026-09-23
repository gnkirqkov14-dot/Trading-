export default [
  // ───────────────────────── 1 ─────────────────────────
  {
    id: 1,
    title: "Здравей!",
    emoji: "👋",
    color: "#FF8A65",
    goal: "Поздравяваш, благодариш и се извиняваш учтиво.",
    words: [
      { en: "hello", bg: "здравей / здравейте", emoji: "👋", ex: "Hello, I'm Anna.", exBg: "Здравейте, аз съм Анна.", tip: "h се чува като леко издишване: „хелОу“." },
      { en: "hi", bg: "здрасти", emoji: "😊", ex: "Hi! How are you today?", exBg: "Здрасти! Как си днес?", tip: "По-неофициално от hello – за приятели и колеги." },
      { en: "goodbye", bg: "довиждане", emoji: "✋", ex: "Goodbye and thank you!", exBg: "Довиждане и благодаря!", alt: ["bye", "good bye"] },
      { en: "please", bg: "моля", emoji: "🤲", ex: "A coffee, please.", exBg: "Едно кафе, моля.", tip: "Please е „моля“ само при молба. Когато подаваш нещо, казваш Here you are." },
      { en: "thank you", bg: "благодаря", emoji: "🙏", ex: "Thank you very much!", exBg: "Много благодаря!", alt: ["thanks"], tip: "Звучи като „сенк ю“ – th се казва с език между зъбите." },
      { en: "yes", bg: "да", emoji: "✅", ex: "Yes, thank you very much.", exBg: "Да, много благодаря." },
      { en: "no", bg: "не", emoji: "❌", ex: "No, thank you.", exBg: "Не, благодаря.", tip: "Внимание: в чужбина кимане с глава значи „да“, а клатене – „не“ (обратно на българския навик)." },
      { en: "sorry", bg: "съжалявам / извинявай", emoji: "😔", ex: "Sorry, I'm late.", exBg: "Извинявай, закъснях." },
      { en: "excuse me", bg: "извинете", emoji: "🙋", ex: "Excuse me, where is the hotel?", exBg: "Извинете, къде е хотелът?" },
      { en: "good morning", bg: "добро утро", emoji: "🌅", ex: "Good morning! A coffee, please.", exBg: "Добро утро! Едно кафе, моля." }
    ],
    grammar: {
      title: "Учтиви думи: please, thank you, excuse me, sorry",
      explain: "Англичаните са много учтиви – добавяй <b>please</b> към всяка молба. <b>Excuse me</b> казваш ПРЕДИ да безпокоиш някого (да питаш нещо, да минеш). <b>Sorry</b> казваш СЛЕД като си сбъркал (настъпил си някого, закъснял си). На <b>thank you</b> отговаряме с You're welcome („Няма защо“).",
      table: [
        ["please", "моля (при молба)", "A tea, please."],
        ["thank you", "благодаря", "Thank you very much!"],
        ["excuse me", "извинете (преди да питаш)", "Excuse me, where is…?"],
        ["sorry", "съжалявам (след грешка)", "Sorry, I'm late."]
      ],
      examples: [
        { parts: [["Excuse me,", "k"], ["where is", "v"], ["the hotel?", "o"]], bg: "Извинете, къде е хотелът?" },
        { parts: [["A coffee,", "o"], ["please.", "k"]], bg: "Едно кафе, моля." },
        { parts: [["Sorry,", "k"], ["I", "s"], ["am", "v"], ["late.", "o"]], bg: "Съжалявам, закъснях." }
      ]
    },
    reading: {
      title: "В кафенето",
      text: [
        { en: "Anna is in a café in London.", bg: "Анна е в едно кафене в Лондон." },
        { en: "Good morning! A coffee, please.", bg: "Добро утро! Едно кафе, моля." },
        { en: "Yes, of course. Here you are.", bg: "Да, разбира се. Заповядайте." },
        { en: "Thank you very much!", bg: "Много благодаря!" },
        { en: "Goodbye and thank you!", bg: "Довиждане и благодаря!" }
      ],
      questions: [
        { q: "Къде е Анна?", options: ["В кафене", "В хотел", "На летището"], answer: 0 },
        { q: "Какво поръчва Анна?", options: ["Чай", "Кафе", "Вода"], answer: 1 },
        { q: "Какво казва Анна накрая?", options: ["Добро утро", "Довиждане и благодаря", "Съжалявам"], answer: 1 }
      ]
    },
    phrases: [
      { en: "Excuse me, where is the toilet?", bg: "Извинете, къде е тоалетната?" },
      { en: "No, thank you.", bg: "Не, благодаря." },
      { en: "Thank you, goodbye!", bg: "Благодаря, довиждане!" }
    ]
  },

  // ───────────────────────── 2 ─────────────────────────
  {
    id: 2,
    title: "Аз съм…",
    emoji: "🙋",
    color: "#4FC3F7",
    goal: "Представяш се и казваш откъде си.",
    words: [
      { en: "I", bg: "аз", emoji: "🙋", ex: "I am from Bulgaria.", exBg: "Аз съм от България.", tip: "I (аз) винаги се пише с главна буква, дори в средата на изречението." },
      { en: "you", bg: "ти / вие", emoji: "🧑", ex: "Are you Maria?", exBg: "Вие ли сте Мария?", tip: "You е и „ти“, и „вие“ – еднакво учтиво към всички." },
      { en: "name", bg: "име", emoji: "📛", ex: "My name is Peter.", exBg: "Казвам се Петър." },
      { en: "my", bg: "мой / моя / мое / мои", emoji: "💁", ex: "This is my bag.", exBg: "Това е моята чанта." },
      { en: "your", bg: "твой / ваш", emoji: "🫴", ex: "Is this your bag?", exBg: "Това вашата чанта ли е?" },
      { en: "from", bg: "от", emoji: "🌍", ex: "We are from Sofia.", exBg: "Ние сме от София." },
      { en: "Bulgaria", bg: "България", emoji: "🇧🇬", ex: "Bulgaria is beautiful.", exBg: "България е красива.", tip: "Ударението е на втората сричка: „бълГЕъриа“." },
      { en: "nice to meet you", bg: "приятно ми е (да се запознаем)", emoji: "🤝", ex: "Hi, Anna! Nice to meet you.", exBg: "Здравей, Анна! Приятно ми е.", alt: ["pleased to meet you"], tip: "Казва се само при първа среща. Отговорът е Nice to meet you, too." },
      { en: "how are you", bg: "как си / как сте", emoji: "💬", ex: "Hello, Tom! How are you?", exBg: "Здравей, Том! Как си?" },
      { en: "fine", bg: "добре", emoji: "👍", ex: "I'm fine, thank you.", exBg: "Добре съм, благодаря." }
    ],
    grammar: {
      title: "Глаголът to be (съм)",
      explain: "На български имаме „съм, си, е, сме, сте, са“. На английски глаголът <b>to be</b> има само три форми: <b>am</b>, <b>is</b>, <b>are</b>. Важно: подлогът (I, you, she…) е задължителен – не може само „Am from Bulgaria“. В разговор се съкращава: I'm, you're, he's, she's, we're, they're.",
      table: [
        ["I", "am", "аз съм"],
        ["you", "are", "ти си / вие сте"],
        ["he / she / it", "is", "той / тя / то е"],
        ["we", "are", "ние сме"],
        ["they", "are", "те са"]
      ],
      examples: [
        { parts: [["I", "s"], ["am", "k"], ["from Bulgaria.", "o"]], bg: "Аз съм от България." },
        { parts: [["She", "s"], ["is", "k"], ["fine.", "o"]], bg: "Тя е добре." },
        { parts: [["We", "s"], ["are", "k"], ["from Sofia.", "o"]], bg: "Ние сме от София." }
      ]
    },
    reading: {
      title: "В самолета",
      text: [
        { en: "Hello! My name is Ivan.", bg: "Здравейте! Казвам се Иван." },
        { en: "I am from Bulgaria.", bg: "Аз съм от България." },
        { en: "Hi, Ivan! I'm Emma. I'm from London.", bg: "Здравей, Иван! Аз съм Ема. От Лондон съм." },
        { en: "Nice to meet you, Emma. How are you?", bg: "Приятно ми е, Ема. Как си?" },
        { en: "I'm fine, thank you.", bg: "Добре съм, благодаря." }
      ],
      questions: [
        { q: "Откъде е Иван?", options: ["От България", "От Лондон", "От Рим"], answer: 0 },
        { q: "Как се казва жената?", options: ["Анна", "Ема", "Мария"], answer: 1 },
        { q: "Как е Ема?", options: ["Добре", "Зле", "Уморена"], answer: 0 }
      ]
    },
    phrases: [
      { en: "Hi! I'm from Bulgaria.", bg: "Здравейте! Аз съм от България." },
      { en: "Nice to meet you, too!", bg: "И на мен ми е приятно!" },
      { en: "I'm fine, thanks. And you?", bg: "Добре съм, благодаря. А ти?" }
    ]
  },

  // ───────────────────────── 3 ─────────────────────────
  {
    id: 3,
    title: "Числа 1–10",
    emoji: "🔢",
    color: "#81C784",
    goal: "Броиш до десет и казваш колко неща искаш.",
    words: [
      { en: "one", bg: "едно / един / една", emoji: "1️⃣", ex: "One coffee, please.", exBg: "Едно кафе, моля.", tip: "Чете се „уан“ – с английско w, а не „он“." },
      { en: "two", bg: "две / два", emoji: "2️⃣", ex: "Two teas, please.", exBg: "Два чая, моля.", tip: "Звучи „ту“ – w не се чува." },
      { en: "three", bg: "три", emoji: "3️⃣", ex: "Three apples, please.", exBg: "Три ябълки, моля.", tip: "th – с език между зъбите. Иначе three звучи като tree (дърво)." },
      { en: "four", bg: "четири", emoji: "4️⃣", ex: "A table for four, please.", exBg: "Маса за четирима, моля." },
      { en: "five", bg: "пет", emoji: "5️⃣", ex: "Five euros, please.", exBg: "Пет евро, моля." },
      { en: "six", bg: "шест", emoji: "6️⃣", ex: "It's six o'clock.", exBg: "Часът е шест." },
      { en: "seven", bg: "седем", emoji: "7️⃣", ex: "I'm in room seven.", exBg: "Аз съм в стая седем." },
      { en: "eight", bg: "осем", emoji: "8️⃣", ex: "Bus number eight, please.", exBg: "Автобус номер осем, моля.", tip: "gh не се чете: „ейт“." },
      { en: "nine", bg: "девет", emoji: "9️⃣", ex: "Nine and one is ten.", exBg: "Девет и едно е десет." },
      { en: "ten", bg: "десет", emoji: "🔟", ex: "Ten minutes, please.", exBg: "Десет минути, моля." }
    ],
    grammar: {
      title: "Множествено число с -s",
      explain: "Когато нещата са повече от едно, обикновено добавяме <b>-s</b>: one bag → two bags. След s, sh, ch, x добавяме <b>-es</b>: one bus → two buses. Има и неправилни думи: one man → two men. Числото и прилагателното не се променят – само съществителното.",
      table: [
        ["one bag", "two bags", "чанта – чанти"],
        ["one apple", "three apples", "ябълка – ябълки"],
        ["one bus", "two buses", "автобус – автобуси"],
        ["one man", "two men", "мъж – мъже"]
      ],
      examples: [
        { parts: [["Two", "o"], ["bags,", "k"], ["please.", ""]], bg: "Две чанти, моля." },
        { parts: [["I", "s"], ["have", "v"], ["three", "o"], ["apples.", "k"]], bg: "Имам три ябълки." },
        { parts: [["Two", "o"], ["coffees,", "k"], ["please.", ""]], bg: "Две кафета, моля." }
      ]
    },
    reading: {
      title: "На пазара",
      text: [
        { en: "Hello! Three apples, please.", bg: "Здравейте! Три ябълки, моля." },
        { en: "Three apples? Yes, here you are.", bg: "Три ябълки? Да, заповядайте." },
        { en: "And two bananas, please.", bg: "И два банана, моля." },
        { en: "That's five euros.", bg: "Това прави пет евро." },
        { en: "Thank you! Goodbye!", bg: "Благодаря! Довиждане!" }
      ],
      questions: [
        { q: "Колко ябълки иска клиентът?", options: ["Две", "Три", "Пет"], answer: 1 },
        { q: "Какво още иска?", options: ["Два банана", "Две кафета", "Три банана"], answer: 0 },
        { q: "Колко плаща?", options: ["Три евро", "Десет евро", "Пет евро"], answer: 2 }
      ]
    },
    phrases: [
      { en: "Two coffees, please.", bg: "Две кафета, моля." },
      { en: "A table for two, please.", bg: "Маса за двама, моля." },
      { en: "One more, please.", bg: "Още едно, моля." }
    ]
  },

  // ───────────────────────── 4 ─────────────────────────
  {
    id: 4,
    title: "Числа и цени",
    emoji: "💶",
    color: "#FFB74D",
    goal: "Питаш колко струва нещо и разбираш цената.",
    words: [
      { en: "eleven", bg: "единайсет", emoji: "🕚", ex: "It's eleven euros.", exBg: "Струва единайсет евро.", tip: "Ударението е на второто „е“: „иЛЕвън“." },
      { en: "twelve", bg: "дванайсет", emoji: "🕛", ex: "Twelve eggs, please.", exBg: "Дванайсет яйца, моля." },
      { en: "twenty", bg: "двайсет", emoji: "🧮", ex: "It's twenty euros.", exBg: "Струва двайсет евро.", tip: "Внимавай: thirTEEN (13) има ударение накрая, а THIRty (30) – в началото." },
      { en: "thirty", bg: "трийсет", emoji: "📅", ex: "I am thirty.", exBg: "На трийсет години съм." },
      { en: "fifty", bg: "петдесет", emoji: "🪙", ex: "The ticket is fifty euros.", exBg: "Билетът е петдесет евро." },
      { en: "hundred", bg: "сто", emoji: "💯", ex: "It's a hundred euros.", exBg: "Струва сто евро.", tip: "A hundred = one hundred. 200 е two hundred – без -s." },
      { en: "euro", bg: "евро", emoji: "💶", ex: "One euro, two euros.", exBg: "Едно евро, две евро.", alt: ["euros"], tip: "Чете се „юъроу“, а в множествено число – euros." },
      { en: "price", bg: "цена", emoji: "🏷️", ex: "The price is ten euros.", exBg: "Цената е десет евро." },
      { en: "how much", bg: "колко (струва)", emoji: "💰", ex: "How much is the coffee?", exBg: "Колко струва кафето?" },
      { en: "expensive", bg: "скъп", emoji: "💎", ex: "The hotel is very expensive.", exBg: "Хотелът е много скъп." }
    ],
    grammar: {
      title: "How much is it? – It's … euros.",
      explain: "За цена питаме <b>How much is…?</b> (за едно нещо) или <b>How much are…?</b> (за много неща). Отговорът е <b>It's … euros</b> или <b>They're … euros</b>. Английският не ползва глагол „струва“ – просто is / are.",
      table: [
        ["How much is the tea?", "It's three euros.", "Колко струва чаят? – Три евро."],
        ["How much are the apples?", "They're two euros.", "Колко струват ябълките? – Две евро."]
      ],
      examples: [
        { parts: [["How much", "k"], ["is", "v"], ["it?", "s"]], bg: "Колко струва?" },
        { parts: [["It", "s"], ["is", "v"], ["twenty euros.", "k"]], bg: "Струва двайсет евро." },
        { parts: [["How much", "k"], ["are", "v"], ["the tickets?", "s"]], bg: "Колко струват билетите?" }
      ]
    },
    reading: {
      title: "В магазина за сувенири",
      text: [
        { en: "Excuse me, how much is this cup?", bg: "Извинете, колко струва тази чаша?" },
        { en: "It's twelve euros.", bg: "Струва дванайсет евро." },
        { en: "And how much is the bag?", bg: "А колко струва чантата?" },
        { en: "The bag is fifty euros.", bg: "Чантата е петдесет евро." },
        { en: "Oh, that's expensive! Just the cup, please.", bg: "О, това е скъпо! Само чашата, моля." }
      ],
      questions: [
        { q: "Колко струва чашата?", options: ["12 евро", "20 евро", "50 евро"], answer: 0 },
        { q: "Колко струва чантата?", options: ["15 евро", "50 евро", "100 евро"], answer: 1 },
        { q: "Какво взема клиентът накрая?", options: ["Само чашата", "Само чантата", "Чашата и чантата"], answer: 0 }
      ]
    },
    phrases: [
      { en: "How much is it?", bg: "Колко струва?" },
      { en: "That's too expensive.", bg: "Това е твърде скъпо." },
      { en: "How much is a ticket?", bg: "Колко струва един билет?" }
    ]
  },

  // ───────────────────────── 5 ─────────────────────────
  {
    id: 5,
    title: "Семейство",
    emoji: "👨‍👩‍👧",
    color: "#BA68C8",
    goal: "Разказваш за семейството си и за чие е нещо.",
    words: [
      { en: "mother", bg: "майка", emoji: "👩", ex: "My mother is from Varna.", exBg: "Майка ми е от Варна.", alt: ["mom", "mum"], tip: "th като в „the“ – звучно, с език между зъбите: „мъдър“." },
      { en: "father", bg: "баща", emoji: "👨", ex: "My father is fifty.", exBg: "Баща ми е на петдесет.", alt: ["dad"] },
      { en: "sister", bg: "сестра", emoji: "👭", ex: "Her sister is in London.", exBg: "Сестра ѝ е в Лондон." },
      { en: "brother", bg: "брат", emoji: "👬", ex: "This is my brother, Ivan.", exBg: "Това е брат ми Иван." },
      { en: "son", bg: "син (дете)", emoji: "👦", ex: "My son is ten.", exBg: "Синът ми е на десет.", tip: "Чете се „сън“ – като sun (слънце)." },
      { en: "daughter", bg: "дъщеря", emoji: "👧", ex: "His daughter is twelve.", exBg: "Дъщеря му е на дванайсет.", tip: "gh не се чете: „дОотър“." },
      { en: "wife", bg: "съпруга", emoji: "👰", ex: "This is my wife, Maria.", exBg: "Това е съпругата ми Мария." },
      { en: "husband", bg: "съпруг", emoji: "💑", ex: "Her husband is from Italy.", exBg: "Съпругът ѝ е от Италия." },
      { en: "child", bg: "дете", emoji: "🧒", ex: "One child, two children.", exBg: "Едно дете, две деца.", alt: ["kid"] },
      { en: "friend", bg: "приятел / приятелка", emoji: "🫂", ex: "Tom is my friend.", exBg: "Том е мой приятел.", tip: "Буквата i не се чете: „френд“." }
    ],
    grammar: {
      title: "Чие е? my / your / his / her",
      explain: "На български казваме „майка ми“ или „моята майка“. На английски притежателната дума е винаги ПРЕДИ съществителното: <b>my</b> mother. <b>his</b> = негов (на мъж), <b>her</b> = неин (на жена). Тези думи не се менят по род и число: my son, my daughter, my friends.",
      table: [
        ["I", "my", "мой / моя / мои"],
        ["you", "your", "твой / ваш"],
        ["he", "his", "негов"],
        ["she", "her", "неин"]
      ],
      examples: [
        { parts: [["My", "k"], ["sister", "s"], ["is", "v"], ["in London.", "o"]], bg: "Сестра ми е в Лондон." },
        { parts: [["His", "k"], ["wife", "s"], ["is", "v"], ["from Italy.", "o"]], bg: "Съпругата му е от Италия." },
        { parts: [["Her", "k"], ["brother", "s"], ["is", "v"], ["ten.", "o"]], bg: "Брат ѝ е на десет." }
      ]
    },
    reading: {
      title: "Семейна снимка",
      text: [
        { en: "This is my family.", bg: "Това е моето семейство." },
        { en: "This is my husband, Peter.", bg: "Това е съпругът ми Петър." },
        { en: "His mother and father are from Plovdiv.", bg: "Майка му и баща му са от Пловдив." },
        { en: "My son is Niki and my daughter is Ana.", bg: "Синът ми е Ники, а дъщеря ми – Ана." },
        { en: "Ana is twelve and Niki is eight.", bg: "Ана е на дванайсет, а Ники – на осем." }
      ],
      questions: [
        { q: "Как се казва съпругът?", options: ["Петър", "Ники", "Иван"], answer: 0 },
        { q: "Откъде са родителите на Петър?", options: ["От София", "От Пловдив", "От Варна"], answer: 1 },
        { q: "На колко години е Ана?", options: ["На осем", "На десет", "На дванайсет"], answer: 2 }
      ]
    },
    phrases: [
      { en: "This is my wife, Maria.", bg: "Това е съпругата ми Мария." },
      { en: "Do you have children?", bg: "Имате ли деца?" },
      { en: "I'm here with my family.", bg: "Тук съм със семейството си." }
    ]
  },

  // ───────────────────────── 6 ─────────────────────────
  {
    id: 6,
    title: "Храна",
    emoji: "🍞",
    color: "#E57373",
    goal: "Назоваваш основни храни и напитки и си поръчваш.",
    words: [
      { en: "bread", bg: "хляб", emoji: "🍞", ex: "The bread is fresh.", exBg: "Хлябът е пресен.", tip: "ea тук се чете кратко: „бред“." },
      { en: "water", bg: "вода", emoji: "💧", ex: "A bottle of water, please.", exBg: "Една бутилка вода, моля.", tip: "w се казва със свити устни, като кратко „у“ – не като българско „в“: „уОтър“." },
      { en: "coffee", bg: "кафе", emoji: "☕", ex: "One coffee with milk, please.", exBg: "Едно кафе с мляко, моля." },
      { en: "tea", bg: "чай", emoji: "🍵", ex: "A cup of tea, please.", exBg: "Чаша чай, моля." },
      { en: "milk", bg: "мляко", emoji: "🥛", ex: "Tea with milk, please.", exBg: "Чай с мляко, моля." },
      { en: "egg", bg: "яйце", emoji: "🥚", ex: "An egg and bread, please.", exBg: "Едно яйце и хляб, моля." },
      { en: "cheese", bg: "сирене", emoji: "🧀", ex: "The cheese is from France.", exBg: "Сиренето е от Франция.", tip: "В чужбина cheese обикновено е жълто сирене. Нашето бяло сирене е white cheese или feta." },
      { en: "apple", bg: "ябълка", emoji: "🍎", ex: "An apple, please.", exBg: "Една ябълка, моля." },
      { en: "meat", bg: "месо", emoji: "🥩", ex: "No meat for me, please.", exBg: "Без месо за мен, моля." },
      { en: "fish", bg: "риба", emoji: "🐟", ex: "The fish is very good.", exBg: "Рибата е много хубава." }
    ],
    grammar: {
      title: "Членът a / an",
      explain: "Пред едно нещо английският слага малката дума <b>a</b> или <b>an</b> (един / една / едно). <b>a</b> – пред съгласен звук: a coffee, a tea. <b>an</b> – пред гласен звук: an apple, an egg. Вода, мляко и хляб не се броят, затова пред тях няма a: water, milk, bread.",
      table: [
        ["a", "coffee", "едно кафе"],
        ["a", "fish", "една риба"],
        ["an", "apple", "една ябълка"],
        ["an", "egg", "едно яйце"]
      ],
      examples: [
        { parts: [["I", "s"], ["have", "v"], ["an", "k"], ["apple.", "o"]], bg: "Имам ябълка." },
        { parts: [["A", "k"], ["coffee,", "o"], ["please.", ""]], bg: "Едно кафе, моля." },
        { parts: [["She", "s"], ["wants", "v"], ["an", "k"], ["egg.", "o"]], bg: "Тя иска яйце." }
      ]
    },
    reading: {
      title: "Закуска в кафенето",
      text: [
        { en: "Good morning! A coffee with milk, please.", bg: "Добро утро! Едно кафе с мляко, моля." },
        { en: "And an egg and bread, please.", bg: "И едно яйце с хляб, моля." },
        { en: "My friend wants a tea and an apple.", bg: "Моят приятел иска чай и ябълка." },
        { en: "Do you have cheese? – Yes, we do.", bg: "Имате ли сирене? – Да, имаме." },
        { en: "How much is it? – It's twelve euros.", bg: "Колко струва? – Дванайсет евро." }
      ],
      questions: [
        { q: "Какво пие разказвачът?", options: ["Чай", "Кафе с мляко", "Вода"], answer: 1 },
        { q: "Какво иска приятелят?", options: ["Чай и ябълка", "Кафе и яйце", "Риба"], answer: 0 },
        { q: "Колко плащат?", options: ["Десет евро", "Дванайсет евро", "Двайсет евро"], answer: 1 }
      ]
    },
    phrases: [
      { en: "A bottle of water, please.", bg: "Една бутилка вода, моля." },
      { en: "No meat, please. I'm a vegetarian.", bg: "Без месо, моля. Вегетарианец съм." },
      { en: "Two coffees and a tea, please.", bg: "Две кафета и един чай, моля." }
    ]
  },

  // ───────────────────────── 7 ─────────────────────────
  {
    id: 7,
    title: "В ресторанта",
    emoji: "🍽️",
    color: "#4DB6AC",
    goal: "Поръчваш учтиво в ресторант и искаш сметката.",
    words: [
      { en: "menu", bg: "меню", emoji: "📋", ex: "The menu, please.", exBg: "Менюто, моля.", tip: "Ударението е в началото: „МЕню“." },
      { en: "table", bg: "маса", emoji: "🪑", ex: "A table for two, please.", exBg: "Маса за двама, моля." },
      { en: "bill", bg: "сметка", emoji: "🧾", ex: "The bill, please.", exBg: "Сметката, моля.", alt: ["check"], tip: "Във Великобритания – bill, в САЩ – check." },
      { en: "waiter", bg: "сервитьор", emoji: "🤵", ex: "The waiter is very nice.", exBg: "Сервитьорът е много мил." },
      { en: "breakfast", bg: "закуска", emoji: "🥐", ex: "Breakfast is at eight.", exBg: "Закуската е в осем." },
      { en: "lunch", bg: "обяд", emoji: "🥪", ex: "We have lunch at one.", exBg: "Обядваме в един." },
      { en: "dinner", bg: "вечеря", emoji: "🍝", ex: "Is dinner at seven?", exBg: "Вечерята в седем ли е?" },
      { en: "I'd like", bg: "бих искал(а)", emoji: "🙋‍♀️", ex: "I'd like the fish, please.", exBg: "Бих искал рибата, моля.", alt: ["I would like"], tip: "I'd like е учтиво. I want звучи грубо в ресторант." },
      { en: "delicious", bg: "много вкусен", emoji: "😋", ex: "The cheese is delicious!", exBg: "Сиренето е много вкусно!", tip: "Чете се „дилИшъс“." },
      { en: "glass", bg: "чаша (стъклена)", emoji: "🍷", ex: "A glass of water, please.", exBg: "Чаша вода, моля." }
    ],
    grammar: {
      title: "I'd like… / Can I have…?",
      explain: "В ресторант и магазин учтиво казваме <b>I'd like…</b> (= I would like, „бих искал“) или питаме <b>Can I have…?</b> („Може ли…?“). <b>I want…</b> звучи грубо, като на малко дете. Накрая добавяме <b>please</b>.",
      examples: [
        { parts: [["I'd like", "k"], ["the fish,", "o"], ["please.", ""]], bg: "Бих искал рибата, моля." },
        { parts: [["Can I have", "k"], ["the menu,", "o"], ["please?", ""]], bg: "Може ли менюто, моля?" },
        { parts: [["We'd like", "k"], ["a table for two.", "o"]], bg: "Бихме искали маса за двама." }
      ]
    },
    reading: {
      title: "Вечеря в Рим",
      text: [
        { en: "Anna and her husband are in a restaurant in Rome.", bg: "Анна и съпругът ѝ са в ресторант в Рим." },
        { en: "The waiter brings the menu.", bg: "Сервитьорът носи менюто." },
        { en: "Anna: I'd like the fish and a glass of water.", bg: "Анна: Бих искала рибата и чаша вода." },
        { en: "Her husband: Can I have the meat, please?", bg: "Съпругът ѝ: Може ли месото, моля?" },
        { en: "The dinner is delicious.", bg: "Вечерята е много вкусна." },
        { en: "The bill, please!", bg: "Сметката, моля!" }
      ],
      questions: [
        { q: "Къде са Анна и съпругът ѝ?", options: ["В Рим", "В Лондон", "В София"], answer: 0 },
        { q: "Какво поръчва Анна?", options: ["Месо", "Риба и вода", "Кафе"], answer: 1 },
        { q: "Каква е вечерята?", options: ["Скъпа", "Студена", "Много вкусна"], answer: 2 }
      ]
    },
    phrases: [
      { en: "Can I have the bill, please?", bg: "Може ли сметката, моля?" },
      { en: "I'd like a glass of water, please.", bg: "Бих искал чаша вода, моля." },
      { en: "It's delicious, thank you!", bg: "Много е вкусно, благодаря!" }
    ]
  },

  // ───────────────────────── 8 ─────────────────────────
  {
    id: 8,
    title: "Цветове и описания",
    emoji: "🎨",
    color: "#F06292",
    goal: "Описваш неща по цвят, размер и температура.",
    words: [
      { en: "red", bg: "червен", emoji: "🔴", ex: "I have a red bag.", exBg: "Имам червена чанта." },
      { en: "blue", bg: "син (цвят)", emoji: "🔵", ex: "The sea is blue.", exBg: "Морето е синьо." },
      { en: "green", bg: "зелен", emoji: "🟢", ex: "Green tea, please.", exBg: "Зелен чай, моля.", tip: "Дълго „ии“: „грийн“." },
      { en: "yellow", bg: "жълт", emoji: "🟡", ex: "The taxi is yellow.", exBg: "Таксито е жълто.", tip: "Чете се „йЕлоу“." },
      { en: "black", bg: "черен", emoji: "⚫", ex: "A black coffee, please.", exBg: "Едно черно кафе, моля." },
      { en: "white", bg: "бял", emoji: "⚪", ex: "White or red wine?", exBg: "Бяло или червено вино?", tip: "wh се чете като английско w: „уайт“." },
      { en: "big", bg: "голям", emoji: "🐘", ex: "It's a big hotel.", exBg: "Това е голям хотел." },
      { en: "small", bg: "малък", emoji: "🐭", ex: "A small coffee, please.", exBg: "Едно малко кафе, моля." },
      { en: "hot", bg: "горещ", emoji: "🔥", ex: "The tea is very hot.", exBg: "Чаят е много горещ.", tip: "За храна hot може да значи и „люто“." },
      { en: "cold", bg: "студен", emoji: "🧊", ex: "The water is cold.", exBg: "Водата е студена." }
    ],
    grammar: {
      title: "Прилагателното е ПРЕДИ съществителното",
      explain: "Както на български: „червена кола“ → <b>a red car</b>. Английското прилагателно НЕ се променя по род и число: a red car, a red bag, two red cars (никога „reds“). Може да стои и след is / are: The car is red.",
      examples: [
        { parts: [["a", "o"], ["red", "k"], ["car", "s"]], bg: "червена кола" },
        { parts: [["two", "o"], ["black", "k"], ["coffees", "s"]], bg: "две черни кафета" },
        { parts: [["The tea", "s"], ["is", "v"], ["hot.", "k"]], bg: "Чаят е горещ." }
      ]
    },
    reading: {
      title: "Изгубената чанта",
      text: [
        { en: "Excuse me, my bag is not here.", bg: "Извинете, чантата ми я няма." },
        { en: "Is it a big bag? – No, it's small.", bg: "Голяма чанта ли е? – Не, малка е." },
        { en: "What colour is it? – It's red and black.", bg: "Какъв цвят е? – Червена и черна е." },
        { en: "Is this your bag?", bg: "Това ли е вашата чанта?" },
        { en: "Yes! Thank you very much!", bg: "Да! Много благодаря!" }
      ],
      questions: [
        { q: "Каква е чантата?", options: ["Голяма", "Малка", "Много голяма"], answer: 1 },
        { q: "Какъв цвят е чантата?", options: ["Синя и бяла", "Червена и черна", "Жълта"], answer: 1 },
        { q: "Намира ли се чантата?", options: ["Да", "Не", "Не се казва"], answer: 0 }
      ]
    },
    phrases: [
      { en: "A black coffee, please.", bg: "Едно черно кафе, моля." },
      { en: "Do you have it in blue?", bg: "Имате ли го в синьо?" },
      { en: "A small bottle of cold water, please.", bg: "Една малка бутилка студена вода, моля." }
    ]
  },

  // ───────────────────────── 9 ─────────────────────────
  {
    id: 9,
    title: "Колко е часът?",
    emoji: "🕐",
    color: "#7986CB",
    goal: "Питаш и казваш колко е часът.",
    words: [
      { en: "time", bg: "време / час", emoji: "⏰", ex: "What time is it?", exBg: "Колко е часът?" },
      { en: "hour", bg: "час (60 минути)", emoji: "⏳", ex: "I have an hour.", exBg: "Имам един час.", tip: "h не се чете: „Ауър“. Затова е an hour, а не a hour." },
      { en: "minute", bg: "минута", emoji: "⏱️", ex: "Wait a minute, please.", exBg: "Един момент, моля.", tip: "Чете се „мИнит“." },
      { en: "today", bg: "днес", emoji: "📅", ex: "It's hot today.", exBg: "Днес е горещо." },
      { en: "tomorrow", bg: "утре", emoji: "🔜", ex: "See you tomorrow!", exBg: "До утре!" },
      { en: "yesterday", bg: "вчера", emoji: "🔙", ex: "Yesterday was cold.", exBg: "Вчера беше студено." },
      { en: "morning", bg: "сутрин", emoji: "🌄", ex: "The museum is open in the morning.", exBg: "Музеят е отворен сутрин." },
      { en: "evening", bg: "вечер", emoji: "🌆", ex: "Good evening! A table for two?", exBg: "Добър вечер! Маса за двама?" },
      { en: "night", bg: "нощ", emoji: "🌙", ex: "Good night, my friend!", exBg: "Лека нощ, приятелю!", tip: "Good night значи „лека нощ“ – при сбогуване. За поздрав вечер казвай Good evening." },
      { en: "now", bg: "сега", emoji: "⌚", ex: "The bus is here now.", exBg: "Автобусът е тук сега." }
    ],
    grammar: {
      title: "What time is it? – It's … o'clock",
      explain: "Питаме <b>What time is it?</b> Отговорът започва с <b>It's…</b>. Точен час: <b>It's three o'clock.</b> Три и половина: <b>It's half past three</b> (буквално „половин след три“). Може и просто с числа: It's three thirty.",
      table: [
        ["3:00", "It's three o'clock.", "Три часът е."],
        ["3:30", "It's half past three.", "Три и половина е."],
        ["3:15", "It's three fifteen.", "Три и петнайсет е."],
        ["12:00", "It's twelve o'clock.", "Дванайсет часът е."]
      ],
      examples: [
        { parts: [["What time", "k"], ["is", "v"], ["it?", "s"]], bg: "Колко е часът?" },
        { parts: [["It", "s"], ["is", "v"], ["seven o'clock.", "k"]], bg: "Седем часът е." },
        { parts: [["It", "s"], ["is", "v"], ["half past nine.", "k"]], bg: "Девет и половина е." }
      ]
    },
    reading: {
      title: "Сутрин в хотела",
      text: [
        { en: "Good morning! What time is it?", bg: "Добро утро! Колко е часът?" },
        { en: "It's half past seven.", bg: "Седем и половина е." },
        { en: "Breakfast is now, from seven to ten.", bg: "Закуската е сега, от седем до десет." },
        { en: "Today we are in Paris, and tomorrow in Rome.", bg: "Днес сме в Париж, а утре – в Рим." },
        { en: "The train is at eleven o'clock.", bg: "Влакът е в единайсет часа." }
      ],
      questions: [
        { q: "Колко е часът?", options: ["7:00", "7:30", "11:00"], answer: 1 },
        { q: "До колко часа е закуската?", options: ["До седем", "До десет", "До единайсет"], answer: 1 },
        { q: "Къде ще бъдат утре?", options: ["В Париж", "В Рим", "В Лондон"], answer: 1 }
      ]
    },
    phrases: [
      { en: "Excuse me, what time is it?", bg: "Извинете, колко е часът?" },
      { en: "What time is breakfast?", bg: "В колко часа е закуската?" },
      { en: "See you tomorrow morning!", bg: "До утре сутринта!" }
    ]
  },

  // ───────────────────────── 10 ─────────────────────────
  {
    id: 10,
    title: "Дните",
    emoji: "🗓️",
    color: "#FFCA28",
    goal: "Казваш в кой ден от седмицата става нещо.",
    words: [
      { en: "Monday", bg: "понеделник", emoji: "💼", ex: "I'm at work on Monday.", exBg: "В понеделник съм на работа.", tip: "Дните се пишат винаги с главна буква." },
      { en: "Tuesday", bg: "вторник", emoji: "📚", ex: "My flight is on Tuesday.", exBg: "Полетът ми е във вторник.", tip: "Чете се „тЮзди“ (британски) или „тУзди“ (американски)." },
      { en: "Wednesday", bg: "сряда", emoji: "🐪", ex: "See you on Wednesday!", exBg: "До сряда!", tip: "Първото d не се чете: „уЕнзди“." },
      { en: "Thursday", bg: "четвъртък", emoji: "⚡", ex: "The market is on Thursday.", exBg: "Пазарът е в четвъртък.", tip: "th – с език между зъбите: „тЪрзди“." },
      { en: "Friday", bg: "петък", emoji: "🎉", ex: "Friday is my favourite day.", exBg: "Петък е любимият ми ден." },
      { en: "Saturday", bg: "събота", emoji: "🛍️", ex: "The shops are open on Saturday.", exBg: "Магазините са отворени в събота." },
      { en: "Sunday", bg: "неделя", emoji: "☀️", ex: "On Sunday I'm at home.", exBg: "В неделя съм вкъщи." },
      { en: "week", bg: "седмица", emoji: "📆", ex: "I'm here for one week.", exBg: "Тук съм за една седмица." },
      { en: "weekend", bg: "уикенд, събота и неделя", emoji: "⛺", ex: "Have a nice weekend!", exBg: "Приятен уикенд!" },
      { en: "day", bg: "ден", emoji: "🌞", ex: "Have a nice day!", exBg: "Приятен ден!" }
    ],
    grammar: {
      title: "on Monday / at the weekend",
      explain: "Пред ден от седмицата казваме <b>on</b>: on Monday, on Friday (= „в понеделник“, „в петък“). За уикенда: <b>at the weekend</b> (британски) или <b>on the weekend</b> (американски). Дните на английски се пишат винаги с <b>главна буква</b>: Monday, а не monday.",
      examples: [
        { parts: [["The shop", "s"], ["is", "v"], ["closed", "o"], ["on Sunday.", "k"]], bg: "Магазинът е затворен в неделя." },
        { parts: [["My flight", "s"], ["is", "v"], ["on Friday.", "k"]], bg: "Полетът ми е в петък." },
        { parts: [["We", "s"], ["are", "v"], ["in Sofia", "o"], ["at the weekend.", "k"]], bg: "През уикенда сме в София." }
      ]
    },
    reading: {
      title: "Една седмица в Лондон",
      text: [
        { en: "I'm in London for one week.", bg: "В Лондон съм за една седмица." },
        { en: "On Monday I'm at the British Museum.", bg: "В понеделник съм в Британския музей." },
        { en: "On Wednesday my friend is here, too.", bg: "В сряда и приятелят ми е тук." },
        { en: "On Friday the shops are open until nine.", bg: "В петък магазините са отворени до девет." },
        { en: "At the weekend we are in Oxford.", bg: "През уикенда сме в Оксфорд." }
      ],
      questions: [
        { q: "За колко време е в Лондон?", options: ["За един ден", "За една седмица", "За един месец"], answer: 1 },
        { q: "Кога идва приятелят?", options: ["В понеделник", "В сряда", "В петък"], answer: 1 },
        { q: "Къде са през уикенда?", options: ["В Лондон", "В Оксфорд", "В София"], answer: 1 }
      ]
    },
    phrases: [
      { en: "Is the museum open on Sunday?", bg: "Музеят отворен ли е в неделя?" },
      { en: "I'm here until Friday.", bg: "Тук съм до петък." },
      { en: "See you on Monday!", bg: "До понеделник!" }
    ]
  },

  // ───────────────────────── 11 ─────────────────────────
  {
    id: 11,
    title: "На летището",
    emoji: "✈️",
    color: "#42A5F5",
    goal: "Ориентираш се на летището и питаш къде е нещо.",
    words: [
      { en: "airport", bg: "летище", emoji: "🛫", ex: "The airport is big.", exBg: "Летището е голямо.", tip: "Ударението е в началото: „ЕЪрпорт“." },
      { en: "plane", bg: "самолет", emoji: "✈️", ex: "The plane is small.", exBg: "Самолетът е малък.", alt: ["airplane", "aeroplane"] },
      { en: "ticket", bg: "билет", emoji: "🎫", ex: "Two tickets to London, please.", exBg: "Два билета до Лондон, моля." },
      { en: "passport", bg: "паспорт", emoji: "🛂", ex: "Your passport, please.", exBg: "Паспорта ви, моля." },
      { en: "luggage", bg: "багаж", emoji: "🧳", ex: "My luggage is not here.", exBg: "Багажът ми го няма.", alt: ["baggage"], tip: "Няма множествено число – никога luggages. Чете се „лЪгидж“." },
      { en: "flight", bg: "полет", emoji: "🛩️", ex: "My flight is at ten.", exBg: "Полетът ми е в десет.", tip: "gh не се чете: „флайт“." },
      { en: "gate", bg: "изход (към самолета)", emoji: "🚪", ex: "Where is gate twelve?", exBg: "Къде е изход дванайсет?", tip: "Чете се „гейт“, а не „гате“." },
      { en: "departure", bg: "заминаване / излитане", emoji: "🕘", ex: "Departure is at nine o'clock.", exBg: "Излитането е в девет часа." },
      { en: "arrival", bg: "пристигане / кацане", emoji: "🛬", ex: "Arrival is at six.", exBg: "Пристигането е в шест." },
      { en: "boarding pass", bg: "бордна карта", emoji: "🎟️", ex: "Here is my boarding pass.", exBg: "Ето бордната ми карта." }
    ],
    grammar: {
      title: "Where is…? / Where are…?",
      explain: "Когато търсиш нещо, питаш <b>Where is</b> + едно нещо (Where is the gate?) или <b>Where are</b> + много неща (Where are the toilets?). В разговор: <b>Where's…?</b> Отговорът: It's here. / They're over there.",
      examples: [
        { parts: [["Where", "k"], ["is", "v"], ["gate five?", "s"]], bg: "Къде е изход пет?" },
        { parts: [["Where", "k"], ["are", "v"], ["the toilets?", "s"]], bg: "Къде са тоалетните?" },
        { parts: [["Where's", "k"], ["my passport?", "s"]], bg: "Къде е паспортът ми?" }
      ]
    },
    reading: {
      title: "Полет до Лондон",
      text: [
        { en: "Maria is at the airport in Sofia.", bg: "Мария е на летището в София." },
        { en: "Her flight to London is at half past ten.", bg: "Полетът ѝ до Лондон е в десет и половина." },
        { en: "Here is my passport and my boarding pass.", bg: "Ето паспорта и бордната ми карта." },
        { en: "Excuse me, where is gate seven?", bg: "Извинете, къде е изход седем?" },
        { en: "It's there, next to the café.", bg: "Ето там, до кафенето." },
        { en: "Arrival in London is at twelve o'clock.", bg: "Пристигането в Лондон е в дванайсет часа." }
      ],
      questions: [
        { q: "Къде е Мария?", options: ["На летището в София", "В Лондон", "В хотела"], answer: 0 },
        { q: "В колко часа е полетът?", options: ["10:00", "10:30", "12:00"], answer: 1 },
        { q: "Кой изход търси Мария?", options: ["Пет", "Седем", "Дванайсет"], answer: 1 }
      ]
    },
    phrases: [
      { en: "Is my flight on time?", bg: "Полетът ми навреме ли е?" },
      { en: "Where is the baggage claim?", bg: "Къде се получава багажът?" },
      { en: "Here are my passport and boarding pass.", bg: "Ето моя паспорт и бордната ми карта." }
    ]
  },

  // ───────────────────────── 12 ─────────────────────────
  {
    id: 12,
    title: "Транспорт",
    emoji: "🚌",
    color: "#FF7043",
    goal: "Казваш с какво пътуваш и питаш как да стигнеш някъде.",
    words: [
      { en: "bus", bg: "автобус", emoji: "🚌", ex: "Is this the bus to the airport?", exBg: "Това ли е автобусът за летището?", tip: "Чете се „бъс“, а не „бус“." },
      { en: "train", bg: "влак", emoji: "🚆", ex: "The train is late.", exBg: "Влакът закъснява." },
      { en: "taxi", bg: "такси", emoji: "🚕", ex: "Taxi! To the airport, please.", exBg: "Такси! До летището, моля.", alt: ["cab"] },
      { en: "car", bg: "кола", emoji: "🚗", ex: "We have a small car.", exBg: "Имаме малка кола." },
      { en: "station", bg: "гара / станция", emoji: "🚉", ex: "Where is the train station?", exBg: "Къде е гарата?" },
      { en: "stop", bg: "спирка", emoji: "🚏", ex: "The bus stop is here.", exBg: "Автобусната спирка е тук." },
      { en: "metro", bg: "метро", emoji: "🚇", ex: "The metro is very fast.", exBg: "Метрото е много бързо.", alt: ["subway", "underground"], tip: "В Лондон казват the Underground или the Tube, в САЩ – subway." },
      { en: "bicycle", bg: "велосипед, колело", emoji: "🚲", ex: "My bicycle is blue.", exBg: "Колелото ми е синьо.", alt: ["bike"] },
      { en: "walk", bg: "ходя пеша", emoji: "🚶", ex: "I walk to the station.", exBg: "Ходя пеша до гарата.", tip: "l не се чете: „уок“." },
      { en: "by", bg: "с (превозно средство)", emoji: "🚍", ex: "We travel by train.", exBg: "Пътуваме с влак." }
    ],
    grammar: {
      title: "by bus / by train / on foot",
      explain: "С какво пътуваш: <b>by</b> + превозно средство, без a или the: by bus, by train, by taxi, by car. Пеша е изключение: <b>on foot</b> (или просто I walk). За да питаш как да стигнеш някъде: <b>How do I get to</b> the station?",
      examples: [
        { parts: [["We", "s"], ["travel", "v"], ["by train.", "k"]], bg: "Пътуваме с влак." },
        { parts: [["I", "s"], ["go", "v"], ["on foot.", "k"]], bg: "Ходя пеша." },
        { parts: [["How do I get to", "k"], ["the airport?", "o"]], bg: "Как да стигна до летището?" }
      ]
    },
    reading: {
      title: "От летището до хотела",
      text: [
        { en: "We are at the airport in Barcelona.", bg: "На летището в Барселона сме." },
        { en: "How do we get to the hotel?", bg: "Как да стигнем до хотела?" },
        { en: "By taxi it's fifty euros – that's expensive.", bg: "С такси е петдесет евро – скъпо е." },
        { en: "By metro it's only five euros.", bg: "С метро е само пет евро." },
        { en: "The metro station is here, at the airport.", bg: "Станцията на метрото е тук, на летището." },
        { en: "We travel by metro!", bg: "Пътуваме с метро!" }
      ],
      questions: [
        { q: "В кой град са?", options: ["В Барселона", "В Рим", "В Лондон"], answer: 0 },
        { q: "Колко струва таксито?", options: ["Пет евро", "Петнайсет евро", "Петдесет евро"], answer: 2 },
        { q: "С какво пътуват накрая?", options: ["С такси", "С метро", "С автобус"], answer: 1 }
      ]
    },
    phrases: [
      { en: "How do I get to the station?", bg: "Как да стигна до гарата?" },
      { en: "Where is the bus stop?", bg: "Къде е автобусната спирка?" },
      { en: "One ticket to the city centre, please.", bg: "Един билет до центъра, моля." }
    ]
  },

  // ───────────────────────── 13 ─────────────────────────
  {
    id: 13,
    title: "Посоки",
    emoji: "🧭",
    color: "#26A69A",
    goal: "Питаш за пътя и разбираш прости указания.",
    words: [
      { en: "left", bg: "ляво / наляво", emoji: "⬅️", ex: "Turn left at the bank.", exBg: "Завийте наляво при банката." },
      { en: "right", bg: "дясно / надясно", emoji: "➡️", ex: "The hotel is on the right.", exBg: "Хотелът е вдясно.", tip: "Right значи и „правилно“: That's right! = Точно така!" },
      { en: "straight", bg: "направо", emoji: "⬆️", ex: "Go straight for two minutes.", exBg: "Вървете направо две минути.", alt: ["straight on", "straight ahead"], tip: "gh не се чете: „стрейт“." },
      { en: "near", bg: "близо", emoji: "📍", ex: "Is it near here?", exBg: "Близо ли е оттук?" },
      { en: "far", bg: "далеч", emoji: "🔭", ex: "The airport is far.", exBg: "Летището е далеч." },
      { en: "street", bg: "улица", emoji: "🛣️", ex: "What street is this?", exBg: "Коя е тази улица?" },
      { en: "corner", bg: "ъгъл", emoji: "📐", ex: "The café is on the corner.", exBg: "Кафенето е на ъгъла." },
      { en: "map", bg: "карта", emoji: "🗺️", ex: "Here is a map of the city.", exBg: "Ето карта на града." },
      { en: "here", bg: "тук", emoji: "👇", ex: "Sign here, please.", exBg: "Подпишете тук, моля.", tip: "Чете се „хиър“ – като hear (чувам)." },
      { en: "there", bg: "там", emoji: "👉", ex: "The station is over there.", exBg: "Гарата е ето там.", tip: "th е звучно, с език между зъбите: „зеър“ (не „деър“)." }
    ],
    grammar: {
      title: "Указания: Turn left. Go straight.",
      explain: "За указания ползваме глагола в основна форма, без подлог: <b>Turn</b> left. <b>Go</b> straight. <b>Stop</b> here. Това е като българското „Завий!“, „Върви!“. Отрицание: <b>Don't</b> turn right. Добави please, за да звучи учтиво.",
      examples: [
        { parts: [["Turn", "k"], ["left.", "o"]], bg: "Завий наляво." },
        { parts: [["Go", "k"], ["straight", "o"], ["for five minutes.", "o"]], bg: "Върви направо пет минути." },
        { parts: [["Don't", "k"], ["turn", "v"], ["right.", "o"]], bg: "Не завивай надясно." }
      ]
    },
    reading: {
      title: "Къде е музеят?",
      text: [
        { en: "Excuse me, where is the museum?", bg: "Извинете, къде е музеят?" },
        { en: "It's not far. Go straight on this street.", bg: "Не е далеч. Вървете направо по тази улица." },
        { en: "Then turn right at the corner.", bg: "После завийте надясно на ъгъла." },
        { en: "The museum is on the left, near a big park.", bg: "Музеят е вляво, близо до един голям парк." },
        { en: "Thank you! Is it far on foot? – No, it's five minutes.", bg: "Благодаря! Далеч ли е пеша? – Не, пет минути е." }
      ],
      questions: [
        { q: "Далеч ли е музеят?", options: ["Да, много е далеч", "Не, не е далеч", "Не се казва"], answer: 1 },
        { q: "Накъде се завива на ъгъла?", options: ["Наляво", "Надясно", "Направо"], answer: 1 },
        { q: "От коя страна е музеят?", options: ["Вляво", "Вдясно", "Точно отпред"], answer: 0 }
      ]
    },
    phrases: [
      { en: "Excuse me, is the station far from here?", bg: "Извинете, гарата далеч ли е оттук?" },
      { en: "Can you show me on the map?", bg: "Може ли да ми покажете на картата?" },
      { en: "Is it left or right?", bg: "Наляво или надясно е?" }
    ]
  },

  // ───────────────────────── 14 ─────────────────────────
  {
    id: 14,
    title: "В хотела",
    emoji: "🏨",
    color: "#9575CD",
    goal: "Настаняваш се в хотел и казваш какво има и няма в стаята.",
    words: [
      { en: "hotel", bg: "хотел", emoji: "🏨", ex: "The hotel is near the station.", exBg: "Хотелът е близо до гарата.", tip: "Ударението е на втората сричка: „хоуТЕЛ“." },
      { en: "room", bg: "стая", emoji: "🛋️", ex: "A room for two, please.", exBg: "Стая за двама, моля." },
      { en: "key", bg: "ключ", emoji: "🔑", ex: "Here is your key.", exBg: "Ето ключа ви." },
      { en: "bed", bg: "легло", emoji: "🛏️", ex: "The bed is very big.", exBg: "Леглото е много голямо." },
      { en: "shower", bg: "душ", emoji: "🚿", ex: "The shower is cold.", exBg: "Душът е студен." },
      { en: "reservation", bg: "резервация", emoji: "📝", ex: "I have a reservation.", exBg: "Имам резервация.", alt: ["booking"] },
      { en: "reception", bg: "рецепция", emoji: "🛎️", ex: "Ask at reception, please.", exBg: "Попитайте на рецепцията, моля.", tip: "Чете се „рисЕпшън“." },
      { en: "floor", bg: "етаж", emoji: "🏢", ex: "Breakfast is on the first floor.", exBg: "Закуската е на първия етаж.", tip: "Във Великобритания ground floor е партерът, а first floor – нашият втори етаж." },
      { en: "towel", bg: "кърпа (за баня)", emoji: "🧖", ex: "Two towels, please.", exBg: "Две кърпи, моля.", tip: "Чете се „тАуъл“." },
      { en: "check out", bg: "напускам хотела (освобождавам стаята)", emoji: "📤", ex: "Check out is at twelve.", exBg: "Освобождаването на стаята е в дванайсет.", alt: ["check-out", "checkout"] }
    ],
    grammar: {
      title: "There is / There are (има)",
      explain: "Когато казваш, че някъде ИМА нещо: <b>There is</b> + едно нещо (There's a shower.), <b>There are</b> + много неща (There are two beds.). Въпрос: <b>Is there</b> a towel? <b>Are there</b> towels? Отрицание: There isn't… / There aren't… („няма“).",
      table: [
        ["There is", "a bed.", "Има легло."],
        ["There are", "two beds.", "Има две легла."],
        ["Is there", "a shower?", "Има ли душ?"],
        ["There isn't", "a towel.", "Няма кърпа."]
      ],
      examples: [
        { parts: [["There is", "k"], ["a big bed", "s"], ["in the room.", "o"]], bg: "В стаята има голямо легло." },
        { parts: [["There are", "k"], ["two towels.", "s"]], bg: "Има две кърпи." },
        { parts: [["Is there", "k"], ["a shower?", "s"]], bg: "Има ли душ?" }
      ]
    },
    reading: {
      title: "Пристигане в хотела",
      text: [
        { en: "Good evening! I have a reservation. My name is Petrov.", bg: "Добър вечер! Имам резервация. Казвам се Петров." },
        { en: "Yes, Mr Petrov. Your room is on the second floor.", bg: "Да, господин Петров. Стаята ви е на втория етаж." },
        { en: "There is a big bed and a shower.", bg: "Има голямо легло и душ." },
        { en: "Here is your key. Breakfast is at seven.", bg: "Ето ключа ви. Закуската е в седем." },
        { en: "Excuse me, there are no towels in the room.", bg: "Извинете, в стаята няма кърпи." }
      ],
      questions: [
        { q: "Има ли г-н Петров резервация?", options: ["Да", "Не", "Не се казва"], answer: 0 },
        { q: "Какво има в стаята?", options: ["Голямо легло и душ", "Две легла", "Вана"], answer: 0 },
        { q: "Какъв е проблемът?", options: ["Няма ключ", "Няма кърпи", "Душът е студен"], answer: 1 }
      ]
    },
    phrases: [
      { en: "I have a reservation for two nights.", bg: "Имам резервация за две нощувки." },
      { en: "Is there Wi-Fi in the room?", bg: "Има ли Wi-Fi в стаята?" },
      { en: "What time is check out?", bg: "До колко часа трябва да освободим стаята?" }
    ]
  },

  // ───────────────────────── 15 ─────────────────────────
  {
    id: 15,
    title: "В града",
    emoji: "🏙️",
    color: "#66BB6A",
    goal: "Питаш дали има нужното място наблизо.",
    words: [
      { en: "shop", bg: "магазин", emoji: "🏪", ex: "The shop is open now.", exBg: "Магазинът е отворен сега.", alt: ["store"] },
      { en: "bank", bg: "банка", emoji: "🏦", ex: "The bank is on the corner.", exBg: "Банката е на ъгъла." },
      { en: "pharmacy", bg: "аптека", emoji: "💊", ex: "Is the pharmacy open today?", exBg: "Аптеката отворена ли е днес?", alt: ["chemist", "drugstore"], tip: "Чете се „фАрмъси“. Във Великобритания казват и chemist's." },
      { en: "museum", bg: "музей", emoji: "🏛️", ex: "The museum is free on Sunday.", exBg: "Музеят е безплатен в неделя.", tip: "Ударението е на второто „е“: „мюЗИъм“." },
      { en: "beach", bg: "плаж", emoji: "🏖️", ex: "The beach is near the hotel.", exBg: "Плажът е близо до хотела.", tip: "Произнасяй дълго „ии“: „бийч“. С кратко „и“ звучи като груба дума!" },
      { en: "park", bg: "парк", emoji: "🌳", ex: "There is a big park here.", exBg: "Тук има голям парк." },
      { en: "restaurant", bg: "ресторант", emoji: "🍴", ex: "This restaurant is very good.", exBg: "Този ресторант е много хубав." },
      { en: "supermarket", bg: "супермаркет", emoji: "🛒", ex: "The supermarket is open until ten.", exBg: "Супермаркетът работи до десет." },
      { en: "toilet", bg: "тоалетна", emoji: "🚻", ex: "Where is the toilet, please?", exBg: "Къде е тоалетната, моля?", alt: ["restroom", "bathroom"], tip: "В САЩ по-учтиво се казва restroom или bathroom." },
      { en: "church", bg: "църква", emoji: "⛪", ex: "The old church is beautiful.", exBg: "Старата църква е красива." }
    ],
    grammar: {
      title: "Is there a … near here?",
      explain: "В непознат град питай: <b>Is there a</b> pharmacy <b>near here?</b> („Има ли аптека наблизо?“). Отговорите са: <b>Yes, there is.</b> / <b>No, there isn't.</b> За много неща: <b>Are there any</b> restaurants near here?",
      examples: [
        { parts: [["Is there", "k"], ["a bank", "s"], ["near here?", "o"]], bg: "Има ли банка наблизо?" },
        { parts: [["Yes,", "o"], ["there is.", "k"]], bg: "Да, има." },
        { parts: [["Are there any", "k"], ["restaurants", "s"], ["near here?", "o"]], bg: "Има ли ресторанти наблизо?" }
      ]
    },
    reading: {
      title: "Разходка в Барселона",
      text: [
        { en: "Excuse me, is there a supermarket near here?", bg: "Извинете, има ли супермаркет наблизо?" },
        { en: "Yes, there is. Go straight and turn left.", bg: "Да, има. Вървете направо и завийте наляво." },
        { en: "It's next to the bank, on the corner.", bg: "До банката е, на ъгъла." },
        { en: "And is there a pharmacy? – No, there isn't. Sorry.", bg: "А има ли аптека? – Не, няма. Съжалявам." },
        { en: "The beach is not far – it's ten minutes on foot.", bg: "Плажът не е далеч – на десет минути пеша е." }
      ],
      questions: [
        { q: "Какво търси туристът първо?", options: ["Супермаркет", "Аптека", "Плаж"], answer: 0 },
        { q: "До какво е супермаркетът?", options: ["До църквата", "До банката", "До парка"], answer: 1 },
        { q: "Има ли аптека наблизо?", options: ["Да", "Не", "Не се знае"], answer: 1 }
      ]
    },
    phrases: [
      { en: "Is there an ATM near here?", bg: "Има ли банкомат наблизо?" },
      { en: "Where is the nearest supermarket?", bg: "Къде е най-близкият супермаркет?" },
      { en: "What time does the museum open?", bg: "В колко часа отваря музеят?" }
    ]
  }
];
