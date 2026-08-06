'use strict';
(() => {
  const REVISION_RU='7 августа 2026 года';
  const REVISION_UK='7 серпня 2026 року';
  const REVISION_EN='August 7, 2026';
  const DRAFT_RU='Коммерческий проект. Не опубликован как окончательная юридическая редакция; перед приёмом реальных платежей требуются реквизиты оператора, применимое право и юридическая проверка.';
  const DRAFT_UK='Комерційний проєкт. Не опубліковано як остаточну юридичну редакцію; до приймання реальних платежів потрібні реквізити оператора, застосовне право та юридична перевірка.';
  const DRAFT_EN='Commercial draft. Not published as the final legal version; operator details, governing law and legal review are required before real payments are accepted.';
  const COPY={
    terms:{
      ru:{title:'Условия использования',revision:`Редакция: ${REVISION_RU}. ${DRAFT_RU}`,sections:[
        ['1. Сервис','CRYPTO LAB предоставляет инструменты отображения рыночных данных, технического анализа, сканирования, расчёта риска, сигналов, портфеля, торгового журнала, бэктеста и AI-пояснений. Сервис не является биржей, брокером, доверительным управляющим или персональным финансовым консультантом.'],
        ['2. Аккаунт','Пользователь отвечает за корректность предоставленных данных, безопасность доступа и действия в своём аккаунте. Запрещены передача аккаунта для обхода ограничений, несанкционированный доступ к чужим данным, вредоносная автоматизация и обход защитных механизмов.'],
        ['3. Рыночные данные, сигналы и AI','Котировки, индикаторы, сигналы и AI-ответы могут задерживаться, содержать ошибки или быть недоступными. Сигнал класса A, индикатор, уровень, бэктест или AI-вывод не является гарантией движения цены, прибыли или сохранения капитала.'],
        ['4. Тарифы','Планируемые коммерческие тарифы кандидата v79: BASIC — 20 USD за месяц, PRO — 49 USD за месяц. Они не активированы до отдельного решения владельца и коммерческого запуска. Продление предусмотрено вручную; отмена прекращает будущий доступ с конца уже оплаченного периода, если обязательное право не требует иного.'],
        ['5. Платежи','Оплата должна приниматься только через сеть, актив и адрес, указанные в подтверждённом счёте. Пользователь обязан проверить сеть и адрес перед отправкой. Реальные on-chain платежи и receiving addresses не активируются до отдельного решения владельца и завершения sandbox E2E.'],
        ['6. Возвраты','Возвраты регулируются отдельной Refund Policy. Обязательные права потребителей сохраняются. Торговые убытки, движение рынка или отсутствие ожидаемой прибыли сами по себе не означают ненадлежащее оказание цифрового сервиса.'],
        ['7. Доступ и прекращение','CRYPTO LAB может временно ограничить доступ для безопасности, предотвращения злоупотреблений, технического обслуживания или при существенном нарушении условий. Полное прекращение платного доступа после возврата регулируется Refund Policy.'],
        ['8. Ответственность пользователя','Пользователь самостоятельно проверяет данные, определяет размер риска и принимает торговые или инвестиционные решения на собственный риск. Нельзя использовать средства, потеря которых угрожает базовым потребностям.'],
        ['9. Оператор и применимое право','Юридическое имя оператора, регистрационные данные, адрес, контакт для претензий и применимое право ещё не утверждены. Коммерческий запуск и приём реальных платежей должны оставаться заблокированными до заполнения этих данных и юридической проверки.']
      ],note:'CRYPTO LAB не обещает прибыль и не предоставляет индивидуальную инвестиционную рекомендацию. Окончательная версия условий требует юридической проверки под фактическую юрисдикцию оператора и рынки обслуживания.'},
      uk:{title:'Умови використання',revision:`Редакція: ${REVISION_UK}. ${DRAFT_UK}`,sections:[
        ['1. Сервіс','CRYPTO LAB надає інструменти відображення ринкових даних, технічного аналізу, сканування, розрахунку ризику, сигналів, портфеля, торгового журналу, бектесту та AI-пояснень. Сервіс не є біржею, брокером, довірчим керуючим або персональним фінансовим консультантом.'],
        ['2. Акаунт','Користувач відповідає за коректність наданих даних, безпеку доступу та дії у своєму акаунті. Заборонені передача акаунта для обходу обмежень, несанкціонований доступ до чужих даних, шкідлива автоматизація та обхід захисних механізмів.'],
        ['3. Ринкові дані, сигнали та AI','Котирування, індикатори, сигнали та AI-відповіді можуть затримуватися, містити помилки або бути недоступними. Сигнал класу A, індикатор, рівень, бектест або AI-висновок не є гарантією руху ціни, прибутку чи збереження капіталу.'],
        ['4. Тарифи','Заплановані комерційні тарифи кандидата v79: BASIC — 20 USD на місяць, PRO — 49 USD на місяць. Вони не активовані до окремого рішення власника та комерційного запуску. Продовження передбачено вручну; скасування припиняє майбутній доступ із кінця вже оплаченого періоду, якщо обов’язкове право не вимагає іншого.'],
        ['5. Платежі','Оплата має прийматися лише через мережу, актив та адресу, зазначені в підтвердженому рахунку. Користувач повинен перевірити мережу й адресу перед відправленням. Реальні on-chain платежі та receiving addresses не активуються до окремого рішення власника й завершення sandbox E2E.'],
        ['6. Повернення','Повернення регулюються окремою Refund Policy. Обов’язкові права споживачів зберігаються. Торгові збитки, рух ринку або відсутність очікуваного прибутку самі по собі не означають неналежне надання цифрового сервісу.'],
        ['7. Доступ і припинення','CRYPTO LAB може тимчасово обмежити доступ для безпеки, запобігання зловживанням, технічного обслуговування або у разі істотного порушення умов. Повне припинення платного доступу після повернення регулюється Refund Policy.'],
        ['8. Відповідальність користувача','Користувач самостійно перевіряє дані, визначає розмір ризику та приймає торгові або інвестиційні рішення на власний ризик. Не можна використовувати кошти, втрата яких загрожує базовим потребам.'],
        ['9. Оператор і застосовне право','Юридична назва оператора, реєстраційні дані, адреса, контакт для претензій та застосовне право ще не затверджені. Комерційний запуск і приймання реальних платежів мають залишатися заблокованими до заповнення цих даних та юридичної перевірки.']
      ],note:'CRYPTO LAB не обіцяє прибуток і не надає індивідуальну інвестиційну рекомендацію. Остаточна редакція потребує юридичної перевірки під фактичну юрисдикцію оператора та ринки обслуговування.'},
      en:{title:'Terms of Use',revision:`Revision: ${REVISION_EN}. ${DRAFT_EN}`,sections:[
        ['1. Service','CRYPTO LAB provides market-data visualization, technical analysis, scanning, risk calculation, signals, portfolio, trade-journal, backtesting and AI explanation tools. It is not an exchange, broker, discretionary asset manager or personal financial adviser.'],
        ['2. Account','Users are responsible for accurate account information, access security and activity under their account. Account sharing to circumvent limits, unauthorized access to other users’ data, malicious automation and security-control circumvention are prohibited.'],
        ['3. Market data, signals and AI','Quotes, indicators, signals and AI outputs may be delayed, inaccurate or unavailable. A class-A signal, indicator, level, backtest or AI output is not a guarantee of price movement, profit or capital preservation.'],
        ['4. Plans','Planned commercial pricing for candidate v79 is BASIC at USD 20 per month and PRO at USD 49 per month. These plans remain inactive until a separate owner decision and commercial launch. Renewal is intended to be manual; cancellation ends future access at the end of the already-paid period unless mandatory law requires otherwise.'],
        ['5. Payments','Payment must only be sent using the network, asset and address shown on a verified invoice. Users must verify the network and destination before sending. Real on-chain payments and receiving addresses remain disabled until a separate owner decision and successful sandbox E2E.'],
        ['6. Refunds','Refunds are governed by the separate Refund Policy. Mandatory consumer rights are preserved. Trading losses, market movement or failure to achieve an expected profit do not by themselves mean that the digital service was not supplied correctly.'],
        ['7. Access and suspension','CRYPTO LAB may temporarily restrict access for security, abuse prevention, maintenance or material breach. Termination of paid access after a full refund is governed by the Refund Policy.'],
        ['8. User responsibility','Users independently verify data, choose risk size and make trading or investment decisions at their own risk. Funds whose loss would affect essential needs should not be used.'],
        ['9. Operator and governing law','The operator’s legal name, registration details, address, complaint contact and governing law have not yet been approved. Commercial launch and real payment acceptance must remain blocked until these details are completed and legally reviewed.']
      ],note:'CRYPTO LAB does not promise profit and does not provide individualized investment advice. The final terms require legal review for the operator’s actual jurisdiction and served markets.'}
    },
    privacy:{
      ru:{title:'Политика конфиденциальности',revision:`Редакция: ${REVISION_RU}. ${DRAFT_RU}`,sections:[
        ['1. Какие данные обрабатываются','CRYPTO LAB может обрабатывать email, технический идентификатор аккаунта, имя профиля, язык, часовой пояс, тариф, счётчики использования, избранные активы, портфель, торговый журнал, заявки на тариф, историю платежных событий, обращения поддержки, AI и backtest operational records, а также данные, введённые пользователем.'],
        ['2. Цели','Данные используются для входа и восстановления доступа, сохранения настроек, предоставления функций сервиса, применения тарифных лимитов, диагностики, предотвращения злоупотреблений, поддержки, выставления и проверки счетов и выполнения обязательных юридических требований.'],
        ['3. Защита регистрации','Публичная регистрация остаётся закрытой до отдельной активации. После запуска могут использоваться CAPTCHA, rate limits и HMAC-хеши технических признаков для предотвращения злоупотреблений. Секретные ключи и пароли не должны попадать в такие журналы.'],
        ['4. Поставщики','В зависимости от фактической конфигурации могут использоваться Supabase, GitHub Pages, Binance, OpenAI, Cloudflare Turnstile, почтовый relay и выбранные blockchain RPC/indexer-провайдеры. Окончательный список получателей данных должен быть подтверждён перед запуском.'],
        ['5. AI','В AI-сервисы передаётся только контекст, необходимый для конкретной функции. Пользователь не должен вводить seed-фразы, приватные ключи, пароли или иные секреты. Необработанные секреты не предназначены для хранения платформой.'],
        ['6. Хранение и удаление','Сроки хранения определяются назначением данных, безопасностью, договорными и обязательными требованиями. Пользователь может запросить копию или удаление данных; платёжные, antifraud и юридически обязательные записи могут храниться дольше, если этого требует применимое право.'],
        ['7. Безопасность','Пользовательские таблицы должны защищаться Row Level Security и серверными проверками авторизации. Секреты остаются на серверной стороне. Доступ к административным функциям и журналам должен быть ограничен.'],
        ['8. Права пользователя','В зависимости от применимого права пользователь может иметь права на доступ, исправление, удаление, ограничение обработки, переносимость данных и обращение в надзорный орган. Конкретная процедура и контакт должны быть опубликованы до коммерческого запуска.'],
        ['9. Оператор и контакт','Контролёр/оператор данных, юридический адрес, privacy-contact, применимое право и трансграничные механизмы передачи данных ещё не утверждены. Эти поля являются обязательным блокером финальной публикации.']
      ],note:'Это рабочий privacy-документ, а не заключение юриста. До коммерческого запуска требуется сопоставить фактические потоки данных с юрисдикцией оператора и рынками обслуживания.'},
      uk:{title:'Політика конфіденційності',revision:`Редакція: ${REVISION_UK}. ${DRAFT_UK}`,sections:[
        ['1. Які дані обробляються','CRYPTO LAB може обробляти email, технічний ідентифікатор акаунта, ім’я профілю, мову, часовий пояс, тариф, лічильники використання, обрані активи, портфель, торговий журнал, заявки на тариф, історію платіжних подій, звернення підтримки, AI і backtest operational records, а також дані, введені користувачем.'],
        ['2. Цілі','Дані використовуються для входу й відновлення доступу, збереження налаштувань, надання функцій сервісу, застосування тарифних лімітів, діагностики, запобігання зловживанням, підтримки, виставлення та перевірки рахунків і виконання обов’язкових юридичних вимог.'],
        ['3. Захист реєстрації','Публічна реєстрація залишається закритою до окремої активації. Після запуску можуть використовуватися CAPTCHA, rate limits і HMAC-хеші технічних ознак для запобігання зловживанням. Секретні ключі та паролі не повинні потрапляти до таких журналів.'],
        ['4. Постачальники','Залежно від фактичної конфігурації можуть використовуватися Supabase, GitHub Pages, Binance, OpenAI, Cloudflare Turnstile, поштовий relay та обрані blockchain RPC/indexer-провайдери. Остаточний список отримувачів даних має бути підтверджений до запуску.'],
        ['5. AI','До AI-сервісів передається лише контекст, необхідний для конкретної функції. Користувач не повинен вводити seed-фрази, приватні ключі, паролі чи інші секрети. Необроблені секрети не призначені для зберігання платформою.'],
        ['6. Зберігання та видалення','Строки зберігання визначаються призначенням даних, безпекою, договірними та обов’язковими вимогами. Користувач може запитати копію або видалення даних; платіжні, antifraud та юридично обов’язкові записи можуть зберігатися довше, якщо цього вимагає застосовне право.'],
        ['7. Безпека','Користувацькі таблиці мають бути захищені Row Level Security та серверними перевірками авторизації. Секрети залишаються на серверній стороні. Доступ до адміністративних функцій і журналів має бути обмежений.'],
        ['8. Права користувача','Залежно від застосовного права користувач може мати права на доступ, виправлення, видалення, обмеження обробки, переносимість даних та звернення до наглядового органу. Конкретна процедура й контакт мають бути опубліковані до комерційного запуску.'],
        ['9. Оператор і контакт','Контролер/оператор даних, юридична адреса, privacy-contact, застосовне право та механізми транскордонної передачі даних ще не затверджені. Ці поля є обов’язковим блокером фінальної публікації.']
      ],note:'Це робочий privacy-документ, а не висновок юриста. До комерційного запуску потрібно зіставити фактичні потоки даних із юрисдикцією оператора та ринками обслуговування.'},
      en:{title:'Privacy Policy',revision:`Revision: ${REVISION_EN}. ${DRAFT_EN}`,sections:[
        ['1. Data processed','CRYPTO LAB may process email, account identifier, profile name, language, timezone, plan, usage counters, favorites, portfolio, trade journal, plan requests, payment-event history, support records, AI and backtest operational records, and data entered by the user.'],
        ['2. Purposes','Data is used for sign-in and recovery, settings, service delivery, plan limits, diagnostics, abuse prevention, support, invoice verification and compliance with mandatory legal obligations.'],
        ['3. Registration protection','Public registration remains closed until separately activated. After launch, CAPTCHA, rate limits and HMAC hashes of technical signals may be used to prevent abuse. Secret keys and passwords must not be stored in these ledgers.'],
        ['4. Service providers','Depending on the final configuration, providers may include Supabase, GitHub Pages, Binance, OpenAI, Cloudflare Turnstile, an email relay and selected blockchain RPC/indexer providers. The final recipient list must be confirmed before launch.'],
        ['5. AI','Only context needed for a specific AI function should be sent to AI services. Users must not submit seed phrases, private keys, passwords or other secrets. Raw secrets are not intended to be stored by the platform.'],
        ['6. Retention and deletion','Retention depends on purpose, security, contract and mandatory requirements. Users may request a copy or deletion of data; payment, antifraud and legally required records may be retained longer where applicable law requires it.'],
        ['7. Security','User tables must be protected by Row Level Security and server-side authorization checks. Secrets remain server-side. Administrative functions and logs must be access-controlled.'],
        ['8. User rights','Depending on applicable law, users may have rights of access, correction, deletion, restriction, portability and complaint to a supervisory authority. The exact process and contact must be published before commercial launch.'],
        ['9. Controller/operator','The data controller/operator, legal address, privacy contact, governing law and cross-border transfer mechanisms have not yet been approved. These fields are a mandatory blocker for final publication.']
      ],note:'This is a working privacy document, not legal advice. Before commercial launch, actual data flows must be mapped to the operator’s jurisdiction and served markets.'}
    },
    refund:{
      ru:{title:'Политика возвратов',revision:`Редакция: ${REVISION_RU}. Основано на утверждённой владельцем Refund Policy v1; публикация и выполнение возвратов не активированы.`,sections:[
        ['1. Область действия','Политика применяется к платному месячному доступу к цифровому сервису CRYPTO LAB и не ограничивает обязательные права потребителей по применимому законодательству.'],
        ['2. Когда возможен возврат','Полный или пропорциональный возврат может быть одобрен при двойной оплате, подтверждённой неоплатной активации после корректного платежа, непредоставлении сервиса, существенном несоответствии, неустранённом в разумный срок, неблагоприятном существенном изменении сервиса, подтверждённой несанкционированной оплате либо когда возврат обязателен по закону.'],
        ['3. Отмена','Отмена прекращает будущее продление. Она не создаёт автоматического права на возврат за корректно предоставленный и соответствующий описанию период, кроме случаев, когда применимое право требует иного. Recurring billing остаётся выключенным до отдельного решения.'],
        ['4. Обычно не являются основанием','Если закон не требует иного, сами по себе не являются основанием торговые убытки, упущенная прибыль, движение рынка, неудовлетворённость рыночным результатом, отправка неподдерживаемого актива или в неверную сеть/адрес, внешние blockchain fees/delays, а также нарушение Terms of Use. Эти исключения не ограничивают обязательные права при непредоставлении, существенном несоответствии, двойной оплате и иных защищённых законом случаях.'],
        ['5. Запрос','Запрос подаётся через поддержку или опубликованный email оператора и должен включать account identifier/email, invoice ID, transaction hash, сеть, актив, причину и доступные доказательства. CRYPTO LAB может запросить разумное доказательство контроля платёжного или возвратного кошелька, но никогда не seed-фразу, приватный ключ или пароль.'],
        ['6. Рассмотрение и сроки','Запросы рассматриваются вручную. Одобренный возврат или пропорциональное уменьшение цены выполняется в разумный срок и не позднее 14 календарных дней после действительного запроса/уведомления о прекращении, когда такой срок обязателен по применимому законодательству.'],
        ['7. Способ возврата','Где это технически и юридически возможно, возврат выполняется в том же stablecoin и в той же сети на проверенный адрес возврата. Если это невозможно, согласовывается эквивалентный способ. Обязательный возврат не должен перекладывать на потребителя комиссию за обработку или сеть.'],
        ['8. Доступ после возврата','Полный возврат прекращает соответствующий платный доступ. Пропорциональный возврат может сократить или изменить оплаченный период. Экспортируемые пользовательские данные обрабатываются согласно Privacy Policy и применимому праву.'],
        ['9. Fraud/sanctions review','Возврат может быть приостановлен только на разумный срок для проверки мошенничества, повторных требований, санкционных ограничений или контроля адреса без нарушения обязательных юридических сроков.'],
        ['10. Граница активации','Эта политика не включает checkout, recurring billing, refunds, receiving addresses или реальные переводы. Для публикации и технического выполнения возвратов требуются отдельные решения владельца и завершение юридической подготовки.']
      ],note:'Refund Policy v1 утверждена как политика проекта, но остаётся неопубликованной и не разрешает выполнение возвратов до отдельной активации.'},
      uk:{title:'Політика повернень',revision:`Редакція: ${REVISION_UK}. Засновано на затвердженій власником Refund Policy v1; публікацію та виконання повернень не активовано.`,sections:[
        ['1. Сфера дії','Політика застосовується до платного місячного доступу до цифрового сервісу CRYPTO LAB і не обмежує обов’язкові права споживачів за застосовним законодавством.'],
        ['2. Коли можливе повернення','Повне або пропорційне повернення може бути схвалене за подвійної оплати, підтвердженої неактивації після коректного платежу, ненадання сервісу, істотної невідповідності, неусунутої у розумний строк, несприятливої істотної зміни сервісу, підтвердженої несанкціонованої оплати або коли повернення є обов’язковим за законом.'],
        ['3. Скасування','Скасування припиняє майбутнє продовження. Воно не створює автоматичного права на повернення за коректно наданий і відповідний опису період, крім випадків, коли застосовне право вимагає іншого. Recurring billing залишається вимкненим до окремого рішення.'],
        ['4. Зазвичай не є підставою','Якщо закон не вимагає іншого, самі по собі не є підставою торгові збитки, втрачений прибуток, рух ринку, незадоволення ринковим результатом, відправлення непідтримуваного активу або в неправильну мережу/адресу, зовнішні blockchain fees/delays, а також порушення Terms of Use. Ці винятки не обмежують обов’язкові права у випадку ненадання, істотної невідповідності, подвійної оплати та інших захищених законом випадків.'],
        ['5. Запит','Запит подається через підтримку або опублікований email оператора й має містити account identifier/email, invoice ID, transaction hash, мережу, актив, причину та доступні докази. CRYPTO LAB може запросити розумне підтвердження контролю платіжного або адреси повернення, але ніколи не seed-фразу, приватний ключ чи пароль.'],
        ['6. Розгляд і строки','Запити розглядаються вручну. Схвалене повернення або пропорційне зменшення ціни виконується у розумний строк і не пізніше 14 календарних днів після дійсного запиту/повідомлення про припинення, коли такий строк є обов’язковим за застосовним законодавством.'],
        ['7. Спосіб повернення','Де це технічно та юридично можливо, повернення виконується в тому самому stablecoin і в тій самій мережі на перевірену адресу повернення. Якщо це неможливо, погоджується еквівалентний спосіб. Обов’язкове повернення не повинно перекладати на споживача комісію за обробку або мережу.'],
        ['8. Доступ після повернення','Повне повернення припиняє відповідний платний доступ. Пропорційне повернення може скоротити або змінити оплачений період. Експортовані користувацькі дані обробляються згідно з Privacy Policy та застосовним правом.'],
        ['9. Fraud/sanctions review','Повернення може бути призупинене лише на розумний строк для перевірки шахрайства, повторних вимог, санкційних обмежень або контролю адреси без порушення обов’язкових юридичних строків.'],
        ['10. Межа активації','Ця політика не вмикає checkout, recurring billing, refunds, receiving addresses або реальні перекази. Для публікації та технічного виконання повернень потрібні окремі рішення власника й завершення юридичної підготовки.']
      ],note:'Refund Policy v1 затверджена як політика проєкту, але залишається неопублікованою і не дозволяє виконання повернень до окремої активації.'},
      en:{title:'Refund Policy',revision:`Revision: ${REVISION_EN}. Based on owner-approved Refund Policy v1; publication and refund execution remain disabled.`,sections:[
        ['1. Scope','This policy applies to paid monthly access to CRYPTO LAB digital services and preserves all mandatory consumer rights under applicable law.'],
        ['2. Refund eligibility','A full or proportional refund may be approved for duplicate payment, verified failure to activate after a correct payment, non-delivery, material non-conformity not remedied within a reasonable time, an adverse material service modification, confirmed unauthorized payment, or where a refund is otherwise required by law.'],
        ['3. Cancellation','Cancellation stops future renewal. It does not automatically create a refund for a correctly delivered and conforming period unless applicable law requires otherwise. Recurring billing remains disabled until separately approved.'],
        ['4. Cases not ordinarily eligible','Unless applicable law requires otherwise, trading losses, missed profit, market movement, dissatisfaction with a market outcome, unsupported assets, wrong networks or addresses, external blockchain fees/delays, or a Terms violation do not by themselves create refund eligibility. These exclusions never limit mandatory rights for non-delivery, material non-conformity, duplicate payment or other legally protected claims.'],
        ['5. Request and evidence','A request is submitted through support or the published operator email and should include account identifier/email, invoice ID, transaction hash, network, asset, reason and available evidence. CRYPTO LAB may request reasonable proof of control of the paying or return wallet, but never a seed phrase, private key or wallet password.'],
        ['6. Review and timing','Requests are reviewed manually. Approved refunds or proportional price reductions are completed within a reasonable time and no later than 14 calendar days after a valid request or termination notice when that deadline is required by applicable law.'],
        ['7. Refund method','Where technically and legally possible, refunds are returned in the same stablecoin and on the same network to a verified return address. If impossible, an equivalent method may be agreed. A mandatory refund must not impose a refund-processing or network fee on the consumer.'],
        ['8. Access after refund','A full refund ends the corresponding paid access. A proportional refund may shorten or adjust the paid period. Exportable user data remains subject to the Privacy Policy and applicable law.'],
        ['9. Fraud and sanctions review','A refund may be paused only for the time reasonably necessary to investigate fraud, duplicate claims, sanctions or wallet-control concerns, without limiting mandatory legal deadlines.'],
        ['10. Activation boundary','This policy does not enable checkout, recurring billing, refunds, receiving addresses or real transfers. Separate owner decisions and completion of legal readiness are required for publication and refund execution.']
      ],note:'Refund Policy v1 has been approved as a project policy but remains unpublished and does not authorize refund execution until separately activated.'}
    },
    risk:{
      ru:{title:'Раскрытие рисков',revision:`Редакция: ${REVISION_RU}. ${DRAFT_RU}`,sections:[
        ['Криптоактивы относятся к высокорисковым активам','Цена может резко измениться за короткое время. Возможна потеря всей суммы, выделенной на торговлю или инвестиции. Не используйте средства, потеря которых повлияет на базовые потребности.','warn'],
        ['Кредитное плечо','Плечо увеличивает как потенциальную прибыль, так и убыток. Небольшое движение цены может привести к ликвидации. Расчёты CRYPTO LAB являются моделями и не учитывают все правила конкретной биржи.'],
        ['Сигналы и технический анализ','Сигнал класса A, индикатор, уровень или AI-вывод не гарантирует движение цены. Исторические закономерности могут не повториться. Сценарий должен иметь заранее определённое условие отмены.'],
        ['Бэктест','Историческое тестирование не прогнозирует будущую доходность и может не учитывать проскальзывание, funding, ликвидность, задержку исполнения, частичные исполнения, комиссии и технические сбои.'],
        ['Рыночные, технические и custody-риски','Возможны задержки котировок, сбои API/RPC, расхождение цен, делистинг, заморозка вывода, ошибки смарт-контрактов, взломы, потеря доступа к кошельку, regulatory changes и ошибки пользователя при выборе сети или адреса.'],
        ['Stablecoin и blockchain-риски','Stablecoin может потерять привязку, эмитент или сеть могут ограничить операции, транзакция может быть необратимой, а отправка в неверную сеть или на неверный адрес может привести к потере средств.'],
        ['Отсутствие гарантий','CRYPTO LAB не гарантирует прибыль, точность сигнала, непрерывность сервиса, ликвидность, исполнение ордера или сохранность средств на сторонних биржах/кошельках.'],
        ['Ответственность пользователя','Пользователь самостоятельно проверяет данные, размер позиции, Stop Loss, комиссию, ликвидность, сеть и адрес и принимает решения на собственный риск.']
      ],note:'CRYPTO LAB предоставляет аналитические инструменты, а не гарантии результата или индивидуальную инвестиционную рекомендацию.'},
      uk:{title:'Розкриття ризиків',revision:`Редакція: ${REVISION_UK}. ${DRAFT_UK}`,sections:[
        ['Криптоактиви є високоризиковими активами','Ціна може різко змінитися за короткий час. Можлива втрата всієї суми, виділеної на торгівлю чи інвестиції. Не використовуйте кошти, втрата яких вплине на базові потреби.','warn'],
        ['Кредитне плече','Плече збільшує як потенційний прибуток, так і збиток. Невеликий рух ціни може призвести до ліквідації. Розрахунки CRYPTO LAB є моделями й не враховують усі правила конкретної біржі.'],
        ['Сигнали й технічний аналіз','Сигнал класу A, індикатор, рівень або AI-висновок не гарантує рух ціни. Історичні закономірності можуть не повторитися. Сценарій має містити заздалегідь визначену умову скасування.'],
        ['Бектест','Історичне тестування не прогнозує майбутню дохідність і може не враховувати прослизання, funding, ліквідність, затримку виконання, часткові виконання, комісії та технічні збої.'],
        ['Ринкові, технічні та custody-ризики','Можливі затримки котирувань, збої API/RPC, розбіжності цін, делістинг, замороження виведення, помилки смарт-контрактів, злами, втрата доступу до гаманця, regulatory changes та помилки користувача при виборі мережі або адреси.'],
        ['Stablecoin і blockchain-ризики','Stablecoin може втратити прив’язку, емітент або мережа можуть обмежити операції, транзакція може бути незворотною, а відправлення в неправильну мережу чи на неправильну адресу може призвести до втрати коштів.'],
        ['Відсутність гарантій','CRYPTO LAB не гарантує прибуток, точність сигналу, безперервність сервісу, ліквідність, виконання ордера або збереження коштів на сторонніх біржах/гаманцях.'],
        ['Відповідальність користувача','Користувач самостійно перевіряє дані, розмір позиції, Stop Loss, комісію, ліквідність, мережу й адресу та приймає рішення на власний ризик.']
      ],note:'CRYPTO LAB надає аналітичні інструменти, а не гарантії результату чи індивідуальну інвестиційну рекомендацію.'},
      en:{title:'Risk Disclosure',revision:`Revision: ${REVISION_EN}. ${DRAFT_EN}`,sections:[
        ['Cryptoassets are high-risk assets','Prices may move sharply in a short period and the entire amount allocated to trading or investment may be lost. Do not use funds whose loss would affect essential needs.','warn'],
        ['Leverage','Leverage increases both potential gains and losses. A small price movement may cause liquidation. CRYPTO LAB calculations are models and do not include every rule of a specific exchange.'],
        ['Signals and technical analysis','A class-A signal, indicator, level or AI output does not guarantee a price movement. Historical patterns may not repeat. A scenario should have a predefined invalidation condition.'],
        ['Backtesting','Historical testing does not predict future returns and may exclude slippage, funding, liquidity, execution latency, partial fills, fees and technical failures.'],
        ['Market, technical and custody risks','Quotes may be delayed; APIs/RPCs may fail; prices may diverge; assets may be delisted; withdrawals may be frozen; smart contracts may fail; systems may be hacked; wallets may be lost; regulation may change; and users may choose the wrong network or address.'],
        ['Stablecoin and blockchain risks','A stablecoin may depeg, an issuer or network may restrict operations, a transaction may be irreversible, and sending to the wrong network or address may cause permanent loss.'],
        ['No guarantees','CRYPTO LAB does not guarantee profit, signal accuracy, service continuity, liquidity, order execution or custody of funds held on third-party exchanges or wallets.'],
        ['User responsibility','Users independently verify data, position size, Stop Loss, fees, liquidity, network and destination and make decisions at their own risk.']
      ],note:'CRYPTO LAB provides analytical tools, not outcome guarantees or individualized investment recommendations.'}
    }
  };
  const PAGE=document.body.dataset.legalPage;
  const supported=['ru','uk','en'];
  let lang=new URLSearchParams(location.search).get('lang')||localStorage.getItem('cryptoLabLanguage')||'ru';
  if(!supported.includes(lang))lang='ru';
  const $=id=>document.getElementById(id);
  function render(){
    const page=COPY[PAGE]?.[lang]||COPY[PAGE]?.ru;
    if(!page)return;
    document.documentElement.lang=lang;
    document.title=`CRYPTO LAB · ${page.title}`;
    $('legalLang').value=lang;
    $('legalTitle').textContent=page.title;
    $('legalRevision').textContent=page.revision;
    $('legalSections').replaceChildren(...page.sections.map(([title,text,kind])=>{
      const section=document.createElement('section');
      section.className=`card${kind==='warn'?' warn':''}`;
      const h=document.createElement('h2');h.textContent=title;
      const p=document.createElement('p');p.textContent=text;
      section.append(h,p);return section;
    }));
    $('legalNote').textContent=page.note;
    document.querySelectorAll('[data-legal-link]').forEach(link=>{
      const url=new URL(link.getAttribute('href'),location.href);url.searchParams.set('lang',lang);link.setAttribute('href',url.pathname.split('/').pop()+url.search);
    });
    localStorage.setItem('cryptoLabLanguage',lang);
  }
  $('legalLang').addEventListener('change',event=>{
    lang=event.target.value;
    const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);render();
  });
  render();
})();