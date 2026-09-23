export default [
  {
    id: 16,
    title: "Пазаруване",
    emoji: "🏬",
    color: "#EC407A",
    goal: "Пазаруваш дрехи, питаш за размер и плащаш с карта или в брой.",
    words: [
      { en: "buy", bg: "купувам", emoji: "🛒", ex: "Where can I buy a ticket?", exBg: "Къде мога да купя билет?" },
      { en: "pay", bg: "плащам", emoji: "💸", ex: "Can I pay now?", exBg: "Мога ли да платя сега?" },
      { en: "card", bg: "карта (банкова)", emoji: "💳", ex: "Here is my card.", exBg: "Ето картата ми.", tip: "Казват и credit card (кредитна) или debit card (дебитна)." },
      { en: "cash", bg: "пари в брой", emoji: "💶", ex: "I pay in cash.", exBg: "Плащам в брой.", tip: "Внимавай с предлога: in cash (в брой), но by card (с карта)." },
      { en: "size", bg: "размер", emoji: "📏", ex: "What size is this shirt?", exBg: "Какъв размер е тази риза?" },
      { en: "shoes", bg: "обувки", emoji: "👟", ex: "These shoes are expensive.", exBg: "Тези обувки са скъпи.", tip: "Произнася се „шууз“. Една обувка е a shoe." },
      { en: "shirt", bg: "риза", emoji: "👕", ex: "The blue shirt is nice.", exBg: "Синята риза е хубава." },
      { en: "dress", bg: "рокля", emoji: "👗", ex: "The red dress is small.", exBg: "Червената рокля е малка." },
      { en: "money", bg: "пари", emoji: "💵", ex: "I have no money.", exBg: "Нямам пари." },
      { en: "receipt", bg: "касова бележка", emoji: "🧾", ex: "Can I have a receipt?", exBg: "Може ли касова бележка?", tip: "Произнася се „рисийт“ – p не се чете." }
    ],
    grammar: {
      title: "Can I…? (Мога ли да…?)",
      explain: "За учтива молба или за да попиташ дали нещо е позволено, казваш <b>Can I</b> + глагол? На български това е „Мога ли да…?“ или „Може ли да…?“. Глаголът след can е в основна форма – без <b>to</b> и без <b>-s</b>.",
      table: [["Can I", "pay by card?", "Мога ли да платя с карта?"], ["Can I", "try it on?", "Мога ли да го пробвам?"], ["Can I", "have a receipt?", "Може ли касова бележка?"]],
      examples: [
        { parts: [["Can", "k"], ["I", "s"], ["pay", "v"], ["by card?", "o"]], bg: "Мога ли да платя с карта?" },
        { parts: [["Can", "k"], ["I", "s"], ["try", "v"], ["it on?", "o"]], bg: "Мога ли да го пробвам?" },
        { parts: [["Can", "k"], ["I", "s"], ["have", "v"], ["a receipt, please?", "o"]], bg: "Може ли касова бележка, моля?" }
      ]
    },
    reading: {
      title: "В магазина",
      text: [
        { en: "Maria is in a small shop.", bg: "Мария е в малък магазин." },
        { en: "There is a red dress and black shoes.", bg: "Има червена рокля и черни обувки." },
        { en: "The dress is 40 euros.", bg: "Роклята струва 40 евро." },
        { en: "\"Can I try it on?\" \"Yes, of course.\"", bg: "„Мога ли да я пробвам?“ „Да, разбира се.“" },
        { en: "The size is fine. \"Can I pay by card?\"", bg: "Размерът е добър. „Мога ли да платя с карта?“" },
        { en: "\"Yes. Here is your receipt. Thank you!\"", bg: "„Да. Ето касовата ви бележка. Благодаря!“" }
      ],
      questions: [
        { q: "Какво има в магазина?", options: ["Червена рокля и черни обувки", "Синя риза", "Зелена рокля"], answer: 0 },
        { q: "Колко струва роклята?", options: ["14 евро", "40 евро", "400 евро"], answer: 1 },
        { q: "Как плаща Мария?", options: ["В брой", "Не плаща", "С карта"], answer: 2 }
      ]
    },
    phrases: [
      { en: "Can I try it on?", bg: "Мога ли да го пробвам?" },
      { en: "Can I pay in cash?", bg: "Мога ли да платя в брой?" },
      { en: "How much are these shoes?", bg: "Колко струват тези обувки?" }
    ]
  },

  {
    id: 17,
    title: "Важни глаголи",
    emoji: "🏃",
    color: "#43A047",
    goal: "Казваш какво ядеш, пиеш, искаш и харесваш.",
    words: [
      { en: "eat", bg: "ям", emoji: "🍽️", ex: "I eat bread for breakfast.", exBg: "Ям хляб на закуска." },
      { en: "drink", bg: "пия", emoji: "🥤", ex: "We drink coffee in the morning.", exBg: "Сутрин пием кафе." },
      { en: "sleep", bg: "спя", emoji: "😴", ex: "I sleep eight hours.", exBg: "Спя осем часа.", tip: "Дълго „ии“: „слийп“." },
      { en: "go", bg: "отивам, ходя", emoji: "🚶", ex: "We go to the beach.", exBg: "Отиваме на плажа.", tip: "Go to + място: go to the park. Но go home – без to." },
      { en: "come", bg: "идвам", emoji: "🤗", ex: "Come here, please.", exBg: "Ела тук, моля.", tip: "Произнася се „кам“, не „коме“." },
      { en: "see", bg: "виждам", emoji: "👀", ex: "I see the bus.", exBg: "Виждам автобуса." },
      { en: "want", bg: "искам", emoji: "💭", ex: "I want a coffee.", exBg: "Искам кафе.", tip: "„I want“ звучи рязко. В кафене по-учтиво е „I'd like“." },
      { en: "have", bg: "имам", emoji: "🤲", ex: "I have two brothers.", exBg: "Имам двама братя." },
      { en: "like", bg: "харесвам", emoji: "👍", ex: "They like fish.", exBg: "Те харесват риба.", tip: "На български „харесва ми“, на английски „аз харесвам“: I like tea." },
      { en: "need", bg: "трябва ми, нуждая се от", emoji: "❗", ex: "I need a taxi.", exBg: "Трябва ми такси." }
    ],
    grammar: {
      title: "Present Simple с I / you / we / they",
      explain: "Present Simple (сегашно просто време) показва неща, които правим редовно, или факти. С <b>I, you, we, they</b> глаголът остава в основна форма и не се променя: I eat, you eat, we eat, they eat. На български окончанията се менят (ям, ядеш, ядем), а на английски – не. Затова подлогът (I, you, we…) винаги се казва.",
      table: [["I", "eat", "аз ям"], ["you", "eat", "ти ядеш / вие ядете"], ["we", "eat", "ние ядем"], ["they", "eat", "те ядат"]],
      examples: [
        { parts: [["I", "s"], ["drink", "k"], ["tea", "o"]], bg: "Пия чай." },
        { parts: [["We", "s"], ["need", "k"], ["a taxi", "o"]], bg: "Трябва ни такси." },
        { parts: [["They", "s"], ["like", "k"], ["fish", "o"]], bg: "Те харесват риба." }
      ]
    },
    reading: {
      title: "Семейство на почивка",
      text: [
        { en: "We are in London for a week.", bg: "В Лондон сме за една седмица." },
        { en: "We like London very much.", bg: "Много харесваме Лондон." },
        { en: "In the morning, we drink coffee and eat eggs.", bg: "Сутрин пием кафе и ядем яйца." },
        { en: "Then we go to a museum or a park.", bg: "После отиваме в музей или в парк." },
        { en: "The children want apples, not cheese.", bg: "Децата искат ябълки, не сирене." },
        { en: "At night, we sleep well.", bg: "Вечер спим добре." }
      ],
      questions: [
        { q: "Къде е семейството?", options: ["В Лондон", "В Париж", "В Рим"], answer: 0 },
        { q: "Какво пият сутрин?", options: ["Чай", "Кафе", "Мляко"], answer: 1 },
        { q: "Какво искат децата?", options: ["Сирене", "Хляб", "Ябълки"], answer: 2 }
      ]
    },
    phrases: [
      { en: "I need a taxi, please.", bg: "Трябва ми такси, моля." },
      { en: "We want two coffees, please.", bg: "Искаме две кафета, моля." },
      { en: "We have a reservation.", bg: "Имаме резервация." }
    ]
  },

  {
    id: 18,
    title: "Моят ден",
    emoji: "⏰",
    color: "#FB8C00",
    goal: "Разказваш какво правиш всеки ден ти и другите.",
    words: [
      { en: "wake up", bg: "събуждам се", emoji: "⏰", ex: "I wake up at seven.", exBg: "Събуждам се в седем." },
      { en: "work", bg: "работя; работа", emoji: "💼", ex: "She works in a bank.", exBg: "Тя работи в банка.", tip: "Work е и „работа“: go to work – отивам на работа." },
      { en: "home", bg: "дом; вкъщи", emoji: "🏠", ex: "He goes home at six.", exBg: "Той се прибира вкъщи в шест.", tip: "Go home, be at home – без to пред home." },
      { en: "school", bg: "училище", emoji: "🏫", ex: "My son goes to school.", exBg: "Синът ми ходи на училище." },
      { en: "cook", bg: "готвя", emoji: "🍳", ex: "My mother cooks dinner.", exBg: "Майка ми готви вечеря.", tip: "oo тук е кратко „у“: „кук“." },
      { en: "read", bg: "чета", emoji: "📖", ex: "She reads every evening.", exBg: "Тя чете всяка вечер.", tip: "Произнася се „рийд“." },
      { en: "every day", bg: "всеки ден", emoji: "📅", ex: "I drink coffee every day.", exBg: "Пия кафе всеки ден." },
      { en: "always", bg: "винаги", emoji: "♾️", ex: "He always walks to work.", exBg: "Той винаги ходи пеша на работа." },
      { en: "never", bg: "никога", emoji: "🚫", ex: "She never eats meat.", exBg: "Тя никога не яде месо.", tip: "Never вече е отрицание – не добавяй not: I never drink coffee." },
      { en: "usually", bg: "обикновено", emoji: "🔄", ex: "I usually go by bus.", exBg: "Обикновено пътувам с автобус." }
    ],
    grammar: {
      title: "Present Simple с he / she / it (+s / +es)",
      explain: "С <b>he, she, it</b> (той, тя, то) добавяме <b>-s</b> към глагола: I work → she work<b>s</b>. След -o, -sh, -ch, -ss, -x добавяме <b>-es</b>: go → go<b>es</b>, watch → watch<b>es</b>. Внимание: have → <b>has</b>. Думите always, usually, never стоят <b>преди</b> глагола: She always cooks.",
      table: [["I work", "she works", "работя → тя работи"], ["I go", "he goes", "отивам → той отива"], ["I watch", "she watches", "гледам → тя гледа"], ["I have", "he has", "имам → той има"]],
      examples: [
        { parts: [["She", "s"], ["works", "k"], ["in a hotel", "o"]], bg: "Тя работи в хотел." },
        { parts: [["He", "s"], ["goes", "k"], ["home at five", "o"]], bg: "Той се прибира вкъщи в пет." },
        { parts: [["My son", "s"], ["reads", "k"], ["every day", "o"]], bg: "Синът ми чете всеки ден." }
      ]
    },
    reading: {
      title: "Денят на Елена",
      text: [
        { en: "Elena is from Sofia.", bg: "Елена е от София." },
        { en: "She wakes up at six every day.", bg: "Тя се събужда в шест всеки ден." },
        { en: "She drinks coffee and goes to work by metro.", bg: "Пие кафе и отива на работа с метро." },
        { en: "She works in a pharmacy.", bg: "Работи в аптека." },
        { en: "In the evening, she cooks dinner and reads.", bg: "Вечер готви вечеря и чете." },
        { en: "She usually sleeps at eleven.", bg: "Обикновено си ляга в единайсет." }
      ],
      questions: [
        { q: "Кога се събужда Елена?", options: ["В шест", "В седем", "В осем"], answer: 0 },
        { q: "Къде работи тя?", options: ["В банка", "В аптека", "В хотел"], answer: 1 },
        { q: "Как отива на работа?", options: ["С автобус", "Пеша", "С метро"], answer: 2 }
      ]
    },
    phrases: [
      { en: "I work in a bank.", bg: "Работя в банка." },
      { en: "I always have breakfast at the hotel.", bg: "Винаги закусвам в хотела." },
      { en: "I want to go home.", bg: "Искам да се прибера вкъщи." }
    ]
  },

  {
    id: 19,
    title: "Въпросителни думи",
    emoji: "❓",
    color: "#5E35B1",
    goal: "Задаваш въпроси с what, where, when и Do / Does.",
    words: [
      { en: "what", bg: "какво; какъв", emoji: "❓", ex: "What is this?", exBg: "Какво е това?" },
      { en: "where", bg: "къде", emoji: "📍", ex: "Where do you live?", exBg: "Къде живееш?", tip: "wh се чете като „у“: „уеър“." },
      { en: "when", bg: "кога", emoji: "🕐", ex: "When is the flight?", exBg: "Кога е полетът?" },
      { en: "who", bg: "кой, коя", emoji: "🧑", ex: "Who is she?", exBg: "Коя е тя?", tip: "Произнася се „ху“ – w не се чете." },
      { en: "why", bg: "защо", emoji: "🤔", ex: "Why are you here?", exBg: "Защо си тук?" },
      { en: "how", bg: "как", emoji: "🧭", ex: "How do you go to work?", exBg: "Как ходиш на работа?" },
      { en: "which", bg: "кой (от няколко)", emoji: "👈", ex: "Which bus goes to the airport?", exBg: "Кой автобус отива до летището?", tip: "Which – когато избираме от няколко неща: Which one? – Кой/коя?" },
      { en: "how many", bg: "колко (на брой)", emoji: "🔢", ex: "How many children do you have?", exBg: "Колко деца имаш?", tip: "How many + множествено число: how many tickets? За пари – how much." },
      { en: "how old", bg: "на колко години", emoji: "👴", ex: "How old is your son?", exBg: "На колко години е синът ти?" },
      { en: "whose", bg: "чий, чия, чие", emoji: "👜", ex: "Whose bag is this?", exBg: "Чия е тази чанта?" }
    ],
    grammar: {
      title: "Въпроси с Do / Does",
      explain: "В Present Simple въпросите се правят с помощна дума: <b>Do</b> за I / you / we / they и <b>Does</b> за he / she / it. След does глаголът губи -s: Does she work? (не „works“). Въпросителната дума стои най-отпред: <b>Where do</b> you live? На български просто сменяме интонацията, а на английски трябва do / does. Кратък отговор: Yes, I do. / Yes, she does.",
      table: [["Do", "you like tea?", "Харесваш ли чай?"], ["Does", "she work here?", "Тя работи ли тук?"], ["Where do", "they live?", "Къде живеят те?"], ["What does", "he want?", "Какво иска той?"]],
      examples: [
        { parts: [["Do", "k"], ["you", "s"], ["like", "v"], ["coffee?", "o"]], bg: "Харесваш ли кафе?" },
        { parts: [["Where", "o"], ["does", "k"], ["she", "s"], ["work?", "v"]], bg: "Къде работи тя?" },
        { parts: [["When", "o"], ["do", "k"], ["you", "s"], ["wake up?", "v"]], bg: "Кога се събуждаш?" }
      ]
    },
    reading: {
      title: "На рецепцията",
      text: [
        { en: "\"Good evening! What is your name, please?\"", bg: "„Добър вечер! Как се казвате, моля?“" },
        { en: "\"My name is Petar Ivanov. I have a reservation.\"", bg: "„Казвам се Петър Иванов. Имам резервация.“" },
        { en: "\"How many nights?\" \"Three nights.\"", bg: "„Колко нощувки?“ „Три нощувки.“" },
        { en: "\"Which floor is my room on?\" \"Room 305 is on floor three.\"", bg: "„На кой етаж е стаята ми?“ „Стая 305 е на третия етаж.“" },
        { en: "\"When is breakfast?\" \"From seven to ten.\"", bg: "„Кога е закуската?“ „От седем до десет.“" }
      ],
      questions: [
        { q: "Как се казва мъжът?", options: ["Петър Иванов", "Иван Петров", "Петър Иванчев"], answer: 0 },
        { q: "Колко нощувки има?", options: ["Две", "Три", "Пет"], answer: 1 },
        { q: "Кога е закуската?", options: ["От шест до девет", "От осем до единайсет", "От седем до десет"], answer: 2 }
      ]
    },
    phrases: [
      { en: "What time does the museum open?", bg: "В колко часа отваря музеят?" },
      { en: "Which bus goes to the centre?", bg: "Кой автобус отива до центъра?" },
      { en: "Where do I pay?", bg: "Къде да платя?" }
    ]
  },

  {
    id: 20,
    title: "Харесвам / не харесвам",
    emoji: "❤️",
    color: "#AD1457",
    goal: "Казваш какво обичаш и какво не харесваш.",
    words: [
      { en: "love", bg: "обичам", emoji: "❤️", ex: "I love this song.", exBg: "Обичам тази песен." },
      { en: "hate", bg: "мразя", emoji: "😠", ex: "I hate cold coffee.", exBg: "Мразя студено кафе.", tip: "Силна дума. По-учтиво е: I don't like…" },
      { en: "music", bg: "музика", emoji: "🎵", ex: "My husband loves music.", exBg: "Съпругът ми обича музика." },
      { en: "movie", bg: "филм", emoji: "🎬", ex: "Is the movie in English?", exBg: "Филмът на английски ли е?", alt: ["film"], tip: "Movie е американско, film – британско. И двете са правилни." },
      { en: "sport", bg: "спорт", emoji: "⚽", ex: "My son loves sport.", exBg: "Синът ми обича спорта." },
      { en: "book", bg: "книга", emoji: "📚", ex: "This book is very good.", exBg: "Тази книга е много хубава.", tip: "oo тук е кратко „у“: „бук“." },
      { en: "favourite", bg: "любим", emoji: "⭐", ex: "My favourite colour is blue.", exBg: "Любимият ми цвят е синият.", alt: ["favorite"], tip: "Произнася се „фейвърит“. Американците пишат favorite." },
      { en: "dance", bg: "танцувам", emoji: "💃", ex: "We dance every weekend.", exBg: "Танцуваме всеки уикенд." },
      { en: "game", bg: "игра", emoji: "🎲", ex: "I like this game.", exBg: "Харесвам тази игра." },
      { en: "song", bg: "песен", emoji: "🎤", ex: "This is my favourite song.", exBg: "Това е любимата ми песен." }
    ],
    grammar: {
      title: "Отрицание: don't / doesn't",
      explain: "За отрицание в Present Simple ползваме <b>don't</b> (= do not) за I / you / we / they и <b>doesn't</b> (= does not) за he / she / it, а след тях – основна форма на глагола. След doesn't няма -s: She doesn't like (не „likes“). На български казваме само „не“, а на английски – don't / doesn't.",
      table: [["I / you / we / they", "don't like", "не харесвам / не харесваме"], ["he / she / it", "doesn't like", "не харесва"]],
      examples: [
        { parts: [["I", "s"], ["don't", "k"], ["like", "v"], ["sport", "o"]], bg: "Не харесвам спорта." },
        { parts: [["She", "s"], ["doesn't", "k"], ["eat", "v"], ["meat", "o"]], bg: "Тя не яде месо." },
        { parts: [["They", "s"], ["don't", "k"], ["dance", "v"]], bg: "Те не танцуват." }
      ]
    },
    reading: {
      title: "Различни вкусове",
      text: [
        { en: "I love music and I dance every weekend.", bg: "Обичам музиката и танцувам всеки уикенд." },
        { en: "My sister doesn't like music.", bg: "Сестра ми не харесва музика." },
        { en: "She loves books and movies.", bg: "Тя обича книги и филми." },
        { en: "Her favourite movie is Titanic.", bg: "Любимият ѝ филм е „Титаник“." },
        { en: "We don't like the same things, but we both love one game: chess!", bg: "Не харесваме едни и същи неща, но и двете обичаме една игра – шах!" }
      ],
      questions: [
        { q: "Какво прави авторката всеки уикенд?", options: ["Танцува", "Чете", "Готви"], answer: 0 },
        { q: "Какво не харесва сестрата?", options: ["Филми", "Музика", "Книги"], answer: 1 },
        { q: "Коя игра обичат и двете?", options: ["Карти", "Футбол", "Шах"], answer: 2 }
      ]
    },
    phrases: [
      { en: "I don't eat meat.", bg: "Не ям месо." },
      { en: "I don't drink coffee, thank you.", bg: "Не пия кафе, благодаря." },
      { en: "I love this song!", bg: "Обожавам тази песен!" }
    ]
  },

  {
    id: 21,
    title: "Времето",
    emoji: "🌤️",
    color: "#039BE5",
    goal: "Говориш за времето и сезоните.",
    words: [
      { en: "sun", bg: "слънце", emoji: "☀️", ex: "The sun is hot today.", exBg: "Днес слънцето пече силно." },
      { en: "rain", bg: "дъжд; вали", emoji: "🌧️", ex: "I don't like the rain.", exBg: "Не обичам дъжда.", tip: "It's raining – вали (дъжд) в момента." },
      { en: "snow", bg: "сняг", emoji: "❄️", ex: "There is snow in winter.", exBg: "През зимата има сняг.", tip: "Звучи „сноу“. It's snowing – вали сняг." },
      { en: "wind", bg: "вятър", emoji: "💨", ex: "The wind is cold.", exBg: "Вятърът е студен.", tip: "It's windy – ветровито е." },
      { en: "weather", bg: "време (навън)", emoji: "🌦️", ex: "The weather is nice today.", exBg: "Днес времето е хубаво.", tip: "Weather е времето навън, а time – часът. th – с език между зъбите." },
      { en: "warm", bg: "топъл", emoji: "🌡️", ex: "The water is warm.", exBg: "Водата е топла." },
      { en: "cloudy", bg: "облачно", emoji: "☁️", ex: "It's cloudy in London.", exBg: "В Лондон е облачно." },
      { en: "summer", bg: "лято", emoji: "🌻", ex: "We go to the beach in summer.", exBg: "През лятото ходим на плаж." },
      { en: "winter", bg: "зима", emoji: "⛄", ex: "Winter is cold in Bulgaria.", exBg: "Зимата в България е студена." },
      { en: "umbrella", bg: "чадър", emoji: "☂️", ex: "I need an umbrella.", exBg: "Трябва ми чадър." }
    ],
    grammar: {
      title: "It's sunny / It's raining / It's cold",
      explain: "За времето на английски винаги започваме с <b>It</b> – празно „то“, което нищо не значи. На български казваме само „Студено е“ или „Вали“, но на английски <b>It</b> е задължително. <b>It's</b> + прилагателно: sunny, cloudy, windy, cold, hot, warm. <b>It's</b> + глагол с -ing за валежи точно сега: It's raining, It's snowing.",
      table: [["It's", "sunny", "слънчево е"], ["It's", "cloudy", "облачно е"], ["It's", "windy", "ветровито е"], ["It's", "raining", "вали дъжд"], ["It's", "snowing", "вали сняг"]],
      examples: [
        { parts: [["It's", "k"], ["sunny", "o"], ["today", "o"]], bg: "Днес е слънчево." },
        { parts: [["It's", "k"], ["raining", "v"], ["in London", "o"]], bg: "В Лондон вали." },
        { parts: [["It's", "k"], ["very cold", "o"], ["in winter", "o"]], bg: "През зимата е много студено." }
      ]
    },
    reading: {
      title: "Уикенд в Единбург",
      text: [
        { en: "We are in Edinburgh for the weekend.", bg: "В Единбург сме за уикенда." },
        { en: "On Saturday, it's sunny and warm.", bg: "В събота е слънчево и топло." },
        { en: "We walk in the park all day.", bg: "Цял ден се разхождаме в парка." },
        { en: "On Sunday, it's cloudy and windy.", bg: "В неделя е облачно и ветровито." },
        { en: "Then it's raining, and I don't have an umbrella!", bg: "После завалява, а аз нямам чадър!" },
        { en: "We go to a museum and drink hot tea.", bg: "Отиваме в музей и пием горещ чай." }
      ],
      questions: [
        { q: "Какво е времето в събота?", options: ["Слънчево и топло", "Облачно", "Вали сняг"], answer: 0 },
        { q: "Какво е времето в неделя?", options: ["Горещо", "Облачно, ветровито и дъждовно", "Слънчево"], answer: 1 },
        { q: "Къде отиват в неделя?", options: ["В парка", "На плажа", "В музей"], answer: 2 }
      ]
    },
    phrases: [
      { en: "What's the weather like today?", bg: "Какво е времето днес?" },
      { en: "It's very hot today!", bg: "Днес е много горещо!" },
      { en: "Where can I buy an umbrella?", bg: "Къде мога да купя чадър?" }
    ]
  },

  {
    id: 22,
    title: "Здраве",
    emoji: "🩹",
    color: "#00897B",
    goal: "Казваш какво те боли и търсиш лекар или аптека.",
    words: [
      { en: "head", bg: "глава", emoji: "🤕", ex: "My head hurts.", exBg: "Боли ме главата." },
      { en: "stomach", bg: "стомах, корем", emoji: "🤢", ex: "I have a pain in my stomach.", exBg: "Боли ме стомахът.", tip: "Произнася се „стамък“ – ch тук се чете като „к“." },
      { en: "tooth", bg: "зъб", emoji: "🦷", ex: "My tooth hurts a lot.", exBg: "Зъбът много ме боли.", tip: "Множествено число: teeth (зъби)." },
      { en: "doctor", bg: "лекар", emoji: "🩺", ex: "I need a doctor.", exBg: "Трябва ми лекар." },
      { en: "sick", bg: "болен", emoji: "😷", ex: "My daughter is sick.", exBg: "Дъщеря ми е болна.", tip: "Във Великобритания „I feel sick“ често значи „гади ми се“." },
      { en: "pain", bg: "болка", emoji: "😣", ex: "I have a pain here.", exBg: "Тук ме боли." },
      { en: "medicine", bg: "лекарство", emoji: "💊", ex: "Take this medicine twice a day.", exBg: "Вземайте това лекарство два пъти на ден.", tip: "Британците често казват „медсън“." },
      { en: "hospital", bg: "болница", emoji: "🏥", ex: "Where is the hospital?", exBg: "Къде е болницата?" },
      { en: "allergy", bg: "алергия", emoji: "🤧", ex: "I have an allergy to nuts.", exBg: "Имам алергия към ядки.", tip: "Ударението е в началото: „Алъджи“." },
      { en: "fever", bg: "температура, треска", emoji: "🤒", ex: "My son has a fever.", exBg: "Синът ми има температура." }
    ],
    grammar: {
      title: "I have a headache / My … hurts",
      explain: "За болежки има два лесни начина. 1) <b>I have a</b> + болежка: a headache (главоболие), a stomach ache (болки в стомаха), a toothache (зъбобол), a fever (температура). 2) <b>My</b> + част от тялото + <b>hurts</b>: My head hurts. На български казваме „боли <b>ме</b> главата“, а на английски – „моята глава боли“.",
      table: [["I have a", "headache", "боли ме главата"], ["I have a", "stomach ache", "боли ме стомахът"], ["I have a", "toothache", "боли ме зъб"], ["My back", "hurts", "боли ме гърбът"]],
      examples: [
        { parts: [["I", "s"], ["have", "v"], ["a headache", "k"]], bg: "Боли ме главата." },
        { parts: [["My tooth", "s"], ["hurts", "k"]], bg: "Боли ме зъбът." },
        { parts: [["She", "s"], ["has", "v"], ["a fever", "k"]], bg: "Тя има температура." }
      ]
    },
    reading: {
      title: "При лекаря",
      text: [
        { en: "Ivan is on holiday in Greece.", bg: "Иван е на почивка в Гърция." },
        { en: "Today he is sick.", bg: "Днес той е болен." },
        { en: "He has a headache and a fever.", bg: "Боли го главата и има температура." },
        { en: "His wife calls a doctor.", bg: "Жена му вика лекар." },
        { en: "The doctor says: \"Drink a lot of water and take this medicine.\"", bg: "Лекарят казва: „Пийте много вода и вземайте това лекарство.“" },
        { en: "Ivan sleeps all day in the hotel.", bg: "Иван спи цял ден в хотела." }
      ],
      questions: [
        { q: "Къде е Иван?", options: ["В Италия", "В Гърция", "В България"], answer: 1 },
        { q: "Какво има Иван?", options: ["Главоболие и температура", "Зъбобол", "Алергия"], answer: 0 },
        { q: "Какво казва лекарят?", options: ["Да отиде в болница", "Да яде повече", "Да пие много вода и да взема лекарството"], answer: 2 }
      ]
    },
    phrases: [
      { en: "I have an allergy to penicillin.", bg: "Имам алергия към пеницилин." },
      { en: "Where is the nearest hospital?", bg: "Къде е най-близката болница?" },
      { en: "I have a headache. Do you have any medicine?", bg: "Боли ме главата. Имате ли някакво лекарство?" }
    ]
  },

  {
    id: 23,
    title: "Спешни случаи",
    emoji: "🚨",
    color: "#E53935",
    goal: "Молиш за помощ и казваш, че си изгубил нещо.",
    words: [
      { en: "help", bg: "помощ; помагам", emoji: "🆘", ex: "Help! Call the police!", exBg: "Помощ! Обадете се на полицията!", tip: "Can you help me? – Можете ли да ми помогнете?" },
      { en: "police", bg: "полиция", emoji: "👮", ex: "Where is the police station?", exBg: "Къде е полицейският участък?", tip: "Ударението е на второто: „пълИйс“." },
      { en: "fire", bg: "пожар; огън", emoji: "🔥", ex: "There is a fire!", exBg: "Има пожар!" },
      { en: "lost", bg: "изгубен; изгубих", emoji: "🔍", ex: "I am lost.", exBg: "Изгубих се.", tip: "I'm lost – изгубих се (не знам къде съм). I lost my key – изгубих си ключа." },
      { en: "stolen", bg: "откраднат", emoji: "🦹", ex: "My phone was stolen.", exBg: "Откраднаха ми телефона.", tip: "Произнася се „стоулън“." },
      { en: "emergency", bg: "спешен случай", emoji: "🚑", ex: "This is an emergency!", exBg: "Това е спешен случай!", tip: "Телефонът за спешни случаи в Европа е 112, в САЩ – 911." },
      { en: "call", bg: "обаждам се; повиквам", emoji: "📞", ex: "Call me tomorrow, please.", exBg: "Обади ми се утре, моля." },
      { en: "phone", bg: "телефон", emoji: "📱", ex: "Can I use your phone?", exBg: "Може ли да ползвам телефона ви?" },
      { en: "wallet", bg: "портфейл", emoji: "👛", ex: "I lost my wallet.", exBg: "Изгубих си портфейла." },
      { en: "quickly", bg: "бързо", emoji: "⚡", ex: "Please come quickly!", exBg: "Моля, елате бързо!" }
    ],
    grammar: {
      title: "I need… / Please call… / I lost my…",
      explain: "В беда ти трябват кратки и ясни изречения. <b>I need</b> + нещо = трябва ми. <b>Please call</b> + човек/служба = моля, повикайте / обадете се на. <b>I lost my</b> + вещ = изгубих си… (lost е минало време на lose). На английски винаги казваме чие е нещото – my wallet, my passport, а на български често го пропускаме.",
      table: [["I need", "help / a doctor", "трябва ми помощ / лекар"], ["Please call", "the police", "моля, обадете се на полицията"], ["I lost", "my passport", "изгубих си паспорта"]],
      examples: [
        { parts: [["I", "s"], ["need", "k"], ["help", "o"]], bg: "Трябва ми помощ." },
        { parts: [["Please", "o"], ["call", "k"], ["the police", "o"]], bg: "Моля, обадете се на полицията." },
        { parts: [["I", "s"], ["lost", "k"], ["my wallet", "o"]], bg: "Изгубих си портфейла." }
      ]
    },
    reading: {
      title: "На гарата",
      text: [
        { en: "Nikolay is at the train station in Rome.", bg: "Николай е на гарата в Рим." },
        { en: "He wants a ticket, but his wallet is not in his bag!", bg: "Иска да купи билет, но портфейлът му не е в чантата!" },
        { en: "His cards and money are in the wallet.", bg: "Картите и парите му са в портфейла." },
        { en: "He goes to a police officer: \"Excuse me, I need help. I lost my wallet.\"", bg: "Отива при един полицай: „Извинете, трябва ми помощ. Изгубих си портфейла.“" },
        { en: "The officer is very nice and helps him.", bg: "Полицаят е много любезен и му помага." },
        { en: "After one hour, a woman brings the wallet!", bg: "След един час една жена донася портфейла!" }
      ],
      questions: [
        { q: "Къде е Николай?", options: ["На летището", "На гарата в Рим", "В хотела"], answer: 1 },
        { q: "Какво е изгубил?", options: ["Паспорта си", "Телефона си", "Портфейла си"], answer: 2 },
        { q: "Кой донася портфейла?", options: ["Една жена", "Полицаят", "Сервитьорът"], answer: 0 }
      ]
    },
    phrases: [
      { en: "Can you help me, please?", bg: "Можете ли да ми помогнете, моля?" },
      { en: "Please call an ambulance!", bg: "Моля, повикайте линейка!" },
      { en: "I lost my passport. What can I do?", bg: "Изгубих си паспорта. Какво да правя?" }
    ]
  },

  {
    id: 24,
    title: "У дома",
    emoji: "🏡",
    color: "#7CB342",
    goal: "Описваш дом или апартамент и казваш къде са нещата.",
    words: [
      { en: "house", bg: "къща", emoji: "🏡", ex: "Our house is small.", exBg: "Нашата къща е малка.", tip: "House е сградата (къщата), а home – домът, мястото, където живееш." },
      { en: "apartment", bg: "апартамент", emoji: "🏢", ex: "We have a big apartment.", exBg: "Имаме голям апартамент.", alt: ["flat"], tip: "Британците казват flat, американците – apartment." },
      { en: "kitchen", bg: "кухня", emoji: "🥘", ex: "My mother is in the kitchen.", exBg: "Майка ми е в кухнята." },
      { en: "bathroom", bg: "баня", emoji: "🛁", ex: "Where is the bathroom?", exBg: "Къде е банята?", tip: "В Америка bathroom е и учтива дума за тоалетна." },
      { en: "door", bg: "врата", emoji: "🚪", ex: "Please close the door.", exBg: "Моля, затвори вратата.", tip: "Произнася се „доо“ – с дълго „о“." },
      { en: "window", bg: "прозорец", emoji: "🪟", ex: "The window is open.", exBg: "Прозорецът е отворен." },
      { en: "chair", bg: "стол", emoji: "🪑", ex: "The cat is on the chair.", exBg: "Котката е на стола." },
      { en: "sofa", bg: "диван", emoji: "🛋️", ex: "The book is on the sofa.", exBg: "Книгата е на дивана." },
      { en: "bedroom", bg: "спалня", emoji: "🛏️", ex: "The apartment has two bedrooms.", exBg: "Апартаментът има две спални." },
      { en: "garden", bg: "градина", emoji: "🌷", ex: "The children play in the garden.", exBg: "Децата играят в градината." }
    ],
    grammar: {
      title: "Предлози: in / on / under / next to",
      explain: "Предлозите показват къде е нещо. <b>in</b> = в, вътре; <b>on</b> = на, върху; <b>under</b> = под; <b>next to</b> = до, съвсем близо. Често ги ползваме с is / are и there is / there are: The key is <b>on</b> the table.",
      table: [["in", "в, вътре", "in the kitchen"], ["on", "на, върху", "on the table"], ["under", "под", "under the bed"], ["next to", "до", "next to the door"]],
      examples: [
        { parts: [["The keys", "s"], ["are", "v"], ["on", "k"], ["the table", "o"]], bg: "Ключовете са на масата." },
        { parts: [["My passport", "s"], ["is", "v"], ["in", "k"], ["the bag", "o"]], bg: "Паспортът ми е в чантата." },
        { parts: [["The cat", "s"], ["is", "v"], ["under", "k"], ["the sofa", "o"]], bg: "Котката е под дивана." }
      ]
    },
    reading: {
      title: "Апартамент в Барселона",
      text: [
        { en: "Our apartment in Barcelona is small but nice.", bg: "Апартаментът ни в Барселона е малък, но хубав." },
        { en: "There is a kitchen, a bathroom and one bedroom.", bg: "Има кухня, баня и една спалня." },
        { en: "The bed is next to the window.", bg: "Леглото е до прозореца." },
        { en: "There is a big sofa, but there is no TV.", bg: "Има голям диван, но няма телевизор." },
        { en: "The key is under the chair next to the door.", bg: "Ключът е под стола до вратата." }
      ],
      questions: [
        { q: "Колко спални има апартаментът?", options: ["Една", "Две", "Три"], answer: 0 },
        { q: "Къде е леглото?", options: ["До вратата", "До прозореца", "В кухнята"], answer: 1 },
        { q: "Къде е ключът?", options: ["На масата", "В банята", "Под стола до вратата"], answer: 2 }
      ]
    },
    phrases: [
      { en: "The shower in the bathroom doesn't work.", bg: "Душът в банята не работи." },
      { en: "Is there a kitchen in the apartment?", bg: "Има ли кухня в апартамента?" },
      { en: "My key is in the room.", bg: "Ключът ми е в стаята." }
    ]
  },

  {
    id: 25,
    title: "Мога да…",
    emoji: "🙌",
    color: "#F4511E",
    goal: "Казваш какво можеш и молиш да говорят по-бавно.",
    words: [
      { en: "can", bg: "мога", emoji: "💪", ex: "I can help you.", exBg: "Мога да ти помогна.", tip: "Can е еднакво за всички: I can, she can – без -s." },
      { en: "swim", bg: "плувам", emoji: "🏊", ex: "I can swim very well.", exBg: "Мога да плувам много добре." },
      { en: "drive", bg: "карам (кола), шофирам", emoji: "🚙", ex: "My wife can drive.", exBg: "Жена ми може да шофира." },
      { en: "speak", bg: "говоря", emoji: "🗣️", ex: "Do you speak English?", exBg: "Говорите ли английски?", tip: "Speak + език: speak English. Talk – разговарям с някого." },
      { en: "understand", bg: "разбирам", emoji: "💡", ex: "I don't understand.", exBg: "Не разбирам." },
      { en: "repeat", bg: "повтарям", emoji: "🔁", ex: "Can you repeat that, please?", exBg: "Можете ли да повторите, моля?" },
      { en: "slowly", bg: "бавно", emoji: "🐢", ex: "Please speak slowly.", exBg: "Моля, говорете бавно." },
      { en: "English", bg: "английски (език)", emoji: "🇬🇧", ex: "I speak a little English.", exBg: "Говоря малко английски.", tip: "Езиците се пишат с главна буква: English, Bulgarian." },
      { en: "a little", bg: "малко", emoji: "🤏", ex: "I understand a little.", exBg: "Разбирам малко." },
      { en: "again", bg: "отново, пак", emoji: "🔂", ex: "Say it again, please.", exBg: "Кажете го пак, моля.", tip: "Произнася се „ъгЕн“." }
    ],
    grammar: {
      title: "can / can't; Could you…?",
      explain: "<b>can</b> = мога, <b>can't</b> (= cannot) = не мога. След can глаголът е в основна форма, без to: I can swim (не „I can to swim“). За въпрос сменяме местата: <b>Can you</b> help me? За по-учтива молба към непознат казваме <b>Could you</b>…? – например Could you speak slowly, please?",
      table: [["I can", "swim", "мога да плувам"], ["She can't", "drive", "тя не може да шофира"], ["Can you", "help me?", "можеш ли да ми помогнеш?"], ["Could you", "speak slowly?", "бихте ли говорили бавно?"]],
      examples: [
        { parts: [["I", "s"], ["can", "k"], ["speak", "v"], ["a little English", "o"]], bg: "Мога да говоря малко английски." },
        { parts: [["He", "s"], ["can't", "k"], ["drive", "v"]], bg: "Той не може да шофира." },
        { parts: [["Could", "k"], ["you", "s"], ["speak", "v"], ["slowly, please?", "o"]], bg: "Бихте ли говорили бавно, моля?" }
      ]
    },
    reading: {
      title: "Кафе в Дъблин",
      text: [
        { en: "Dimitar is from Bulgaria. He is in a café in Dublin.", bg: "Димитър е от България. Той е в кафене в Дъблин." },
        { en: "He can speak a little English.", bg: "Той говори малко английски." },
        { en: "The waiter speaks very quickly, and Dimitar can't understand.", bg: "Сервитьорът говори много бързо и Димитър не разбира." },
        { en: "\"Sorry, could you repeat that slowly, please?\"", bg: "„Извинете, бихте ли повторили бавно, моля?“" },
        { en: "The waiter says it again, slowly: \"Tea or coffee?\"", bg: "Сервитьорът го казва пак, бавно: „Чай или кафе?“" },
        { en: "\"Coffee, please!\" Now he understands.", bg: "„Кафе, моля!“ Сега той разбира." }
      ],
      questions: [
        { q: "Къде е Димитър?", options: ["В кафене в Дъблин", "В хотел в Лондон", "На летището"], answer: 0 },
        { q: "Защо Димитър не разбира?", options: ["Шумно е", "Сервитьорът говори много бързо", "Не чува добре"], answer: 1 },
        { q: "Какво поръчва Димитър?", options: ["Чай", "Вода", "Кафе"], answer: 2 }
      ]
    },
    phrases: [
      { en: "Could you speak more slowly, please?", bg: "Бихте ли говорили по-бавно, моля?" },
      { en: "Can you write it, please?", bg: "Можете ли да го напишете, моля?" },
      { en: "Sorry, I don't understand.", bg: "Извинете, не разбирам." }
    ]
  },

  {
    id: 26,
    title: "Какво правиш сега?",
    emoji: "⏳",
    color: "#8E24AA",
    goal: "Казваш какво правиш точно сега.",
    words: [
      { en: "wait", bg: "чакам", emoji: "⏳", ex: "I am waiting for the bus.", exBg: "Чакам автобуса.", tip: "Wait for + някого/нещо: wait for a taxi." },
      { en: "look for", bg: "търся", emoji: "🔎", ex: "I am looking for my key.", exBg: "Търся си ключа.", tip: "Look for = търся; look at = гледам към." },
      { en: "listen", bg: "слушам", emoji: "🎧", ex: "She is listening to music.", exBg: "Тя слуша музика.", tip: "t не се чете: „лисън“. Listen to + нещо." },
      { en: "talk", bg: "говоря, разговарям", emoji: "💬", ex: "They are talking on the phone.", exBg: "Те говорят по телефона." },
      { en: "travel", bg: "пътувам", emoji: "✈️", ex: "We are travelling in Italy.", exBg: "Пътуваме из Италия.", tip: "Британски: travelling, американски: traveling – и двете са правилни." },
      { en: "stay", bg: "отсядам; оставам", emoji: "🛎️", ex: "We are staying at a hotel.", exBg: "Отседнали сме в хотел." },
      { en: "visit", bg: "посещавам, разглеждам", emoji: "📸", ex: "They are visiting the museum.", exBg: "Те разглеждат музея." },
      { en: "wear", bg: "нося (дрехи), облечен съм", emoji: "🧥", ex: "She is wearing a red dress.", exBg: "Тя е с червена рокля.", tip: "Wear – за дрехи по теб; carry – нося в ръце." },
      { en: "carry", bg: "нося (в ръце)", emoji: "🛍️", ex: "He is carrying two bags.", exBg: "Той носи две чанти." },
      { en: "open", bg: "отварям; отворен", emoji: "🔓", ex: "I am opening the window.", exBg: "Отварям прозореца." }
    ],
    grammar: {
      title: "Present Continuous (I am waiting)",
      explain: "Present Continuous показва какво става <b>сега, в момента</b>. Образува се с <b>am / is / are</b> + глагол с <b>-ing</b>: I am wait<b>ing</b>. На български казваме просто „чакам“, но на английски „I wait“ е за навик, а „I am waiting“ – за точно сега. Правопис: крайното -e отпада (dance → dancing), а при някои къси глаголи последната буква се удвоява (swim → swimming).",
      table: [["I", "am waiting", "аз чакам"], ["he / she / it", "is waiting", "той / тя чака"], ["you / we / they", "are waiting", "ти чакаш / ние чакаме / те чакат"]],
      examples: [
        { parts: [["I", "s"], ["am waiting", "k"], ["for a taxi", "o"]], bg: "Чакам такси." },
        { parts: [["She", "s"], ["is wearing", "k"], ["a blue dress", "o"]], bg: "Тя е със синя рокля." },
        { parts: [["We", "s"], ["are staying", "k"], ["at a small hotel", "o"]], bg: "Отседнали сме в малък хотел." }
      ]
    },
    reading: {
      title: "Съобщение от Париж",
      text: [
        { en: "Hi, Mum! We are in Paris now.", bg: "Здрасти, мамо! Сега сме в Париж." },
        { en: "It's raining, but we are happy.", bg: "Вали, но сме щастливи." },
        { en: "Right now, we are visiting the Louvre.", bg: "В момента разглеждаме Лувъра." },
        { en: "Georgi is looking for the Mona Lisa on the map.", bg: "Георги търси Мона Лиза на картата." },
        { en: "We are staying at a nice hotel near the river.", bg: "Отседнали сме в хубав хотел близо до реката." }
      ],
      questions: [
        { q: "Какво е времето в Париж?", options: ["Слънчево", "Вали дъжд", "Вали сняг"], answer: 1 },
        { q: "Какво търси Георги на картата?", options: ["Хотела", "Кафене", "Мона Лиза"], answer: 2 },
        { q: "Къде са отседнали?", options: ["В хотел близо до реката", "При приятели", "В апартамент"], answer: 0 }
      ]
    },
    phrases: [
      { en: "I'm looking for the train station.", bg: "Търся гарата." },
      { en: "We are staying at Hotel Central.", bg: "Отседнали сме в хотел „Сентрал“." },
      { en: "I'm waiting for a taxi.", bg: "Чакам такси." }
    ]
  },

  {
    id: 27,
    title: "Месеци и сезони",
    emoji: "🗓️",
    color: "#C0CA33",
    goal: "Казваш дати, месеци и сезони с правилния предлог.",
    words: [
      { en: "spring", bg: "пролет", emoji: "🌸", ex: "Spring is warm and green.", exBg: "Пролетта е топла и зелена." },
      { en: "autumn", bg: "есен", emoji: "🍂", ex: "It's cloudy in autumn.", exBg: "През есента е облачно.", alt: ["fall"], tip: "Американците казват fall." },
      { en: "month", bg: "месец", emoji: "🗓️", ex: "There are twelve months in a year.", exBg: "В годината има дванайсет месеца." },
      { en: "year", bg: "година", emoji: "🎆", ex: "I go to Greece every year.", exBg: "Всяка година ходя в Гърция.", tip: "Внимавай: year („йиър“) не е ear („иър“ – ухо)." },
      { en: "birthday", bg: "рожден ден", emoji: "🎂", ex: "Happy birthday, Anna!", exBg: "Честит рожден ден, Анна!" },
      { en: "holiday", bg: "почивка, ваканция; празник", emoji: "🏝️", ex: "We are on holiday in July.", exBg: "През юли сме на почивка.", tip: "Британски: on holiday; американски: on vacation." },
      { en: "January", bg: "януари", emoji: "🥂", ex: "My birthday is in January.", exBg: "Рожденият ми ден е през януари.", tip: "Месеците винаги се пишат с главна буква." },
      { en: "July", bg: "юли", emoji: "🌞", ex: "It's very hot in July.", exBg: "През юли е много горещо." },
      { en: "December", bg: "декември", emoji: "🎄", ex: "We have snow in December.", exBg: "През декември има сняг." },
      { en: "date", bg: "дата", emoji: "📆", ex: "Write the date here, please.", exBg: "Напишете датата тук, моля." }
    ],
    grammar: {
      title: "in July / in summer / on 5 May",
      explain: "С месеци, сезони и години ползваме <b>in</b>: in July, in summer, in 2025. С конкретна дата и с дни – <b>on</b>: on 5 May, on Monday, on my birthday. С часове – <b>at</b>: at 7 o'clock. На български казваме „през юли“, „на 5 май“, „в 7 часа“ – затова внимавай с предлога.",
      table: [["in", "July / summer / 2025", "през юли / през лятото"], ["on", "5 May / Monday", "на 5 май / в понеделник"], ["at", "7 o'clock", "в 7 часа"]],
      examples: [
        { parts: [["We", "s"], ["go", "v"], ["to the sea", "o"], ["in summer", "k"]], bg: "През лятото ходим на море." },
        { parts: [["My birthday", "s"], ["is", "v"], ["on 12 July", "k"]], bg: "Рожденият ми ден е на 12 юли." },
        { parts: [["It", "s"], ["snows", "v"], ["in December", "k"]], bg: "През декември вали сняг." }
      ]
    },
    reading: {
      title: "Моята година",
      text: [
        { en: "I love holidays!", bg: "Обичам почивките!" },
        { en: "In January, we go skiing in Bansko.", bg: "През януари ходим на ски в Банско." },
        { en: "In spring, my friend and I visit Rome.", bg: "През пролетта с приятелката ми посещаваме Рим." },
        { en: "My birthday is on 20 July, and I always go to the beach.", bg: "Рожденият ми ден е на 20 юли и винаги ходя на плаж." },
        { en: "In autumn, we visit my mother in Plovdiv.", bg: "През есента ходим на гости на майка ми в Пловдив." },
        { en: "In December, the family is at home for Christmas.", bg: "През декември семейството е вкъщи за Коледа." }
      ],
      questions: [
        { q: "Къде ходят през януари?", options: ["В Банско", "В Рим", "В Пловдив"], answer: 0 },
        { q: "Кога е рожденият ден?", options: ["На 20 юни", "На 20 юли", "На 12 юли"], answer: 1 },
        { q: "Какво правят през есента?", options: ["Ходят на плаж", "Карат ски", "Ходят при майката в Пловдив"], answer: 2 }
      ]
    },
    phrases: [
      { en: "What's the date today?", bg: "Коя дата сме днес?" },
      { en: "We are here until 10 August.", bg: "Тук сме до 10 август." },
      { en: "Is the museum open in winter?", bg: "Музеят отворен ли е през зимата?" }
    ]
  },

  {
    id: 28,
    title: "Как беше? (was / were)",
    emoji: "🌟",
    color: "#FFA000",
    goal: "Разказваш как е минало пътуването ти.",
    words: [
      { en: "was", bg: "бях, беше (I / he / she / it)", emoji: "⏪", ex: "I was at home yesterday.", exBg: "Вчера бях вкъщи.", tip: "Was – за I, he, she, it." },
      { en: "were", bg: "бяхме, бяха, беше (you / we / they)", emoji: "⏮️", ex: "We were in Paris last week.", exBg: "Миналата седмица бяхме в Париж.", tip: "Were – за you, we, they." },
      { en: "trip", bg: "пътуване, екскурзия", emoji: "🎒", ex: "How was your trip?", exBg: "Как мина пътуването ти?" },
      { en: "great", bg: "страхотен", emoji: "🤩", ex: "The hotel was great!", exBg: "Хотелът беше страхотен!" },
      { en: "tired", bg: "уморен", emoji: "🥱", ex: "I was very tired.", exBg: "Бях много уморен." },
      { en: "last", bg: "миналия; последен", emoji: "🔙", ex: "Last summer we were in Spain.", exBg: "Миналото лято бяхме в Испания.", tip: "Last week, last year – без the и без предлог: миналата седмица." },
      { en: "ago", bg: "преди (време)", emoji: "⌛", ex: "I was there two years ago.", exBg: "Бях там преди две години.", tip: "Ago стои СЛЕД времето: two days ago = преди два дни." },
      { en: "fun", bg: "забавно, забавление", emoji: "🎉", ex: "The party was fun.", exBg: "Купонът беше забавен." },
      { en: "bad", bg: "лош", emoji: "👎", ex: "The weather was bad.", exBg: "Времето беше лошо." },
      { en: "beautiful", bg: "красив", emoji: "🌅", ex: "The beach was beautiful.", exBg: "Плажът беше красив.", tip: "Произнася се „бютифъл“." }
    ],
    grammar: {
      title: "was / were (минало на to be)",
      explain: "<b>was / were</b> са миналото време на am / is / are. <b>I / he / she / it → was</b>, <b>you / we / they → were</b>. Отрицание: <b>wasn't</b>, <b>weren't</b>. Въпрос – сменяме местата: Was it good? Were you tired?",
      table: [["I / he / she / it", "was", "бях / беше"], ["you / we / they", "were", "беше / бяхме / бяха"], ["отрицание", "wasn't / weren't", "не бях / не бяхме"]],
      examples: [
        { parts: [["The trip", "s"], ["was", "k"], ["great", "o"]], bg: "Пътуването беше страхотно." },
        { parts: [["We", "s"], ["were", "k"], ["tired", "o"]], bg: "Бяхме уморени." },
        { parts: [["Was", "k"], ["the hotel", "s"], ["nice?", "o"]], bg: "Хубав ли беше хотелът?" }
      ]
    },
    reading: {
      title: "Как мина почивката?",
      text: [
        { en: "\"Hi, Elena! How was your trip to Italy?\"", bg: "„Здрасти, Елена! Как мина пътуването ти до Италия?“" },
        { en: "\"It was great, thank you!\"", bg: "„Беше страхотно, благодаря!“" },
        { en: "\"We were in Rome and Venice two weeks ago.\"", bg: "„Преди две седмици бяхме в Рим и Венеция.“" },
        { en: "\"The food was delicious and the city was beautiful.\"", bg: "„Храната беше вкусна, а градът – красив.“" },
        { en: "\"The weather was bad on one day, but it was fun.\"", bg: "„Един ден времето беше лошо, но пак беше забавно.“" },
        { en: "\"On the last day, we were very tired!\"", bg: "„В последния ден бяхме много уморени!“" }
      ],
      questions: [
        { q: "Къде е била Елена?", options: ["В Испания", "В Италия", "В Гърция"], answer: 1 },
        { q: "Кога е била там?", options: ["Преди две седмици", "Миналата година", "Вчера"], answer: 0 },
        { q: "Как са били в последния ден?", options: ["Болни", "Гладни", "Много уморени"], answer: 2 }
      ]
    },
    phrases: [
      { en: "How was your flight?", bg: "Как мина полетът?" },
      { en: "It was a great trip!", bg: "Беше страхотно пътуване!" },
      { en: "I was here two years ago.", bg: "Бях тук преди две години." }
    ]
  },

  {
    id: 29,
    title: "Минало време (-ed)",
    emoji: "📜",
    color: "#3949AB",
    goal: "Разказваш какво си правил вчера с правилни глаголи.",
    words: [
      { en: "visited", bg: "посетих", emoji: "🏛️", ex: "We visited the museum.", exBg: "Посетихме музея.", tip: "След t и d -ed се чете „ид“: „визитид“." },
      { en: "walked", bg: "вървях, ходих пеша", emoji: "👣", ex: "I walked to the beach.", exBg: "Отидох пеша до плажа.", tip: "След k -ed се чете като „т“: „уокт“." },
      { en: "stayed", bg: "отседнах; останах", emoji: "🏨", ex: "We stayed at a nice hotel.", exBg: "Отседнахме в хубав хотел.", tip: "След гласна -ed се чете „д“: „стейд“." },
      { en: "arrived", bg: "пристигнах", emoji: "🛬", ex: "We arrived at the airport at six.", exBg: "Пристигнахме на летището в шест." },
      { en: "booked", bg: "резервирах", emoji: "📝", ex: "I booked a room online.", exBg: "Резервирах стая онлайн.", tip: "Book е и глагол – резервирам. Booked се чете „букт“." },
      { en: "watched", bg: "гледах", emoji: "📺", ex: "We watched a movie last night.", exBg: "Снощи гледахме филм." },
      { en: "played", bg: "играх", emoji: "🎮", ex: "The children played in the park.", exBg: "Децата играха в парка." },
      { en: "cooked", bg: "сготвих", emoji: "🍝", ex: "My husband cooked dinner.", exBg: "Съпругът ми сготви вечеря." },
      { en: "asked", bg: "попитах", emoji: "🙋", ex: "I asked the waiter.", exBg: "Попитах сервитьора." },
      { en: "called", bg: "обадих се", emoji: "☎️", ex: "I called my mother yesterday.", exBg: "Вчера се обадих на майка ми." }
    ],
    grammar: {
      title: "Past Simple на правилни глаголи (+ed)",
      explain: "Past Simple показва завършено действие в миналото (yesterday, last week, two days ago). При правилните глаголи добавяме <b>-ed</b>: visit → visit<b>ed</b>. Ако глаголът завършва на -e, добавяме само <b>-d</b>: arrive → arrived. Формата е еднаква за всички лица. Произношение: <b>/t/</b> след k, p, s, sh, ch (walked, asked); <b>/d/</b> след гласни и звучни звуци (stayed, called); <b>/id/</b> само след t и d (visited, wanted).",
      table: [["/t/", "walked, asked, cooked", "„уокт“, „аскт“, „кукт“"], ["/d/", "stayed, played, called", "„стейд“, „плейд“, „колд“"], ["/id/", "visited, wanted", "„визитид“, „уонтид“"]],
      examples: [
        { parts: [["We", "s"], ["visited", "k"], ["the museum yesterday", "o"]], bg: "Вчера посетихме музея." },
        { parts: [["She", "s"], ["called", "k"], ["a taxi", "o"]], bg: "Тя повика такси." },
        { parts: [["I", "s"], ["booked", "k"], ["a room for two nights", "o"]], bg: "Резервирах стая за две нощувки." }
      ]
    },
    reading: {
      title: "Уикенд в Лондон",
      text: [
        { en: "Last weekend, Maria and her husband visited London.", bg: "Миналия уикенд Мария и съпругът ѝ посетиха Лондон." },
        { en: "They arrived on Friday evening and stayed at a small hotel.", bg: "Пристигнаха в петък вечер и отседнаха в малък хотел." },
        { en: "On Saturday, they walked in the park and visited a museum.", bg: "В събота се разходиха в парка и посетиха музей." },
        { en: "In the evening, Maria asked the waiter for fish and chips.", bg: "Вечерта Мария поиска от сервитьора риба с пържени картофи." },
        { en: "On Sunday, it rained, so they watched a movie.", bg: "В неделя валя, затова гледаха филм." },
        { en: "Maria called her mother: \"We love London!\"", bg: "Мария се обади на майка си: „Обожаваме Лондон!“" }
      ],
      questions: [
        { q: "Кога пристигнаха?", options: ["В петък вечер", "В събота сутрин", "В неделя"], answer: 0 },
        { q: "Какво поръча Мария?", options: ["Пица", "Риба с пържени картофи", "Салата"], answer: 1 },
        { q: "Какво правиха в неделя?", options: ["Разходиха се в парка", "Готвиха", "Гледаха филм"], answer: 2 }
      ]
    },
    phrases: [
      { en: "I booked a table for two.", bg: "Резервирах маса за двама." },
      { en: "We arrived yesterday.", bg: "Пристигнахме вчера." },
      { en: "I called the hotel this morning.", bg: "Обадих се в хотела тази сутрин." }
    ]
  },

  {
    id: 30,
    title: "Неправилни глаголи",
    emoji: "🔀",
    color: "#00ACC1",
    goal: "Разказваш за минали пътувания с най-честите неправилни глаголи.",
    words: [
      { en: "went", bg: "отидох", emoji: "🛣️", ex: "We went to the beach.", exBg: "Отидохме на плажа.", tip: "Минало време на go – съвсем различна дума!" },
      { en: "saw", bg: "видях", emoji: "👁️", ex: "I saw a beautiful church.", exBg: "Видях красива църква.", tip: "Произнася се „соо“." },
      { en: "ate", bg: "ядох", emoji: "🍕", ex: "We ate pizza in Naples.", exBg: "Ядохме пица в Неапол.", tip: "Произнася се „ейт“ – като eight." },
      { en: "had", bg: "имах; изпих, изядох", emoji: "🎁", ex: "I had a coffee at the airport.", exBg: "Изпих едно кафе на летището." },
      { en: "bought", bg: "купих", emoji: "💰", ex: "I bought a new dress.", exBg: "Купих си нова рокля.", tip: "Произнася се „боот“ – gh не се чете." },
      { en: "took", bg: "взех", emoji: "🤚", ex: "We took a taxi to the hotel.", exBg: "Взехме такси до хотела." },
      { en: "came", bg: "дойдох", emoji: "🙌", ex: "My friend came to the airport.", exBg: "Приятелят ми дойде на летището." },
      { en: "did", bg: "направих", emoji: "✅", ex: "What did you do yesterday?", exBg: "Какво прави вчера?", tip: "Did е и помощна дума за въпроси в миналото: Did you go?" },
      { en: "made", bg: "направих (създадох)", emoji: "🛠️", ex: "I made a reservation.", exBg: "Направих резервация.", tip: "Make – правя/създавам нещо (a cake, a reservation); do – извършвам действие." },
      { en: "got", bg: "получих; стигнах", emoji: "📩", ex: "I got your message.", exBg: "Получих съобщението ти." }
    ],
    grammar: {
      title: "Past Simple на неправилни глаголи",
      explain: "Много от най-честите глаголи са <b>неправилни</b> – в миналото не получават -ed, а имат своя форма, която се запомня: go → <b>went</b>. Формата е еднаква за всички лица: I went, she went, they went. Въпрос и отрицание се правят с <b>did / didn't</b> + основна форма: Did you go? I didn't see it.",
      table: [["go", "went", "отивам → отидох"], ["see", "saw", "виждам → видях"], ["eat", "ate", "ям → ядох"], ["have", "had", "имам → имах"], ["buy", "bought", "купувам → купих"], ["take", "took", "вземам → взех"]],
      examples: [
        { parts: [["We", "s"], ["went", "k"], ["to Greece last summer", "o"]], bg: "Миналото лято ходихме в Гърция." },
        { parts: [["I", "s"], ["bought", "k"], ["a new phone", "o"]], bg: "Купих си нов телефон." },
        { parts: [["Did", "k"], ["you", "s"], ["see", "v"], ["the museum?", "o"]], bg: "Видя ли музея?" }
      ]
    },
    reading: {
      title: "Ден в Истанбул",
      text: [
        { en: "Last year, I went to Istanbul with my sister.", bg: "Миналата година отидох в Истанбул със сестра си." },
        { en: "We took a boat and saw the city from the sea.", bg: "Качихме се на корабче и видяхме града от морето." },
        { en: "We ate fish and had Turkish coffee.", bg: "Ядохме риба и пихме турско кафе." },
        { en: "My sister bought a beautiful lamp.", bg: "Сестра ми си купи красива лампа." },
        { en: "In the evening, we came back to the hotel very tired.", bg: "Вечерта се върнахме в хотела много уморени." },
        { en: "It was a great day!", bg: "Беше страхотен ден!" }
      ],
      questions: [
        { q: "С кого отиде разказвачът в Истанбул?", options: ["С брат си", "Със сестра си", "С майка си"], answer: 1 },
        { q: "Какво ядоха?", options: ["Риба", "Месо", "Пица"], answer: 0 },
        { q: "Какво купи сестрата?", options: ["Рокля", "Обувки", "Лампа"], answer: 2 }
      ]
    },
    phrases: [
      { en: "I took the wrong bus.", bg: "Качих се на грешния автобус." },
      { en: "Sorry, I made a mistake.", bg: "Съжалявам, сбърках." },
      { en: "We had a great time, thank you!", bg: "Прекарахме страхотно, благодаря!" }
    ]
  }
];
