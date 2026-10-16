import { useSyncExternalStore } from 'react';

// The Breakup Room speaks three languages. These are not translations of one another:
// each language has its own letters, comforting words, songs and painting, written for
// how people in that language actually talk about heartbreak.

export const BREAKUP_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'te', label: 'తెలుగు' },
];

const KEY = 'sp_breakup_lang';
const codes = BREAKUP_LANGS.map(l => l.code);

function initial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (codes.includes(saved)) return saved;
    const app = (localStorage.getItem('watch_language') || '').split('-')[0].toLowerCase();
    if (codes.includes(app)) return app;
  } catch { /* storage can be unavailable */ }
  return 'en';
}

let lang = initial();
const listeners = new Set();
export const getBreakupLang = () => lang;
export function setBreakupLang(next) {
  if (!codes.includes(next) || next === lang) return;
  lang = next;
  try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  listeners.forEach(l => l());
}
export const useBreakupLang = () => useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, getBreakupLang, getBreakupLang);

export const CONTENT = {
  // ------------------------------------------------------------------ English
  en: {
    ui: {
      title: 'The Breakup Room',
      subtitle: 'A quiet place to grieve, read unspoken words, listen to the rain, and let go.',
      badge: 'HEALING',
      rainOn: 'Play rain', rainOff: 'Mute rain',
      tabs: { music: 'Calm music', letters: 'Unsent letters', burn: 'Burn and release', healing: 'Comfort', art: 'The painting' },
      lettersHead: 'Left in the night drawer',
      chord: 'Strum a sad chord',
      burnTitle: 'Burn and release',
      burnIntro: 'Write what you never got to say. When you are ready, burn the page and let the night take it.',
      burnHint: 'Type your goodbye here. Nobody will read this but the night.',
      burnCount: 'characters, private and never saved',
      burnBtn: 'Burn and release', burnBusy: 'Burning...',
      burnDoneTitle: 'Your words have turned to ash',
      burnDoneBody: 'You loved deeply and bravely. That is nothing to be ashamed of. Take a slow breath. The weight you set down tonight does not have to be picked up tomorrow.',
      burnAgain: 'Write another',
      healingHead: 'Gentle reminders',
      artIntro: 'The painting on the wall',
    },
    letters: [
      { id: 1, time: 'Rainy midnight', author: 'Written at 3:14 AM', title: 'To the person I thought I would grow old with', preview: 'I still reach for my phone every time something good happens...', tags: ['Silence', 'Longing', 'Memory'],
        content: `I still reach for my phone whenever something funny happens on the street, or when our favourite song comes on in a crowded shop. For a second my thumb hovers over your name before the silence hits me all over again.\n\nWe had a whole universe built from whispers, inside jokes and plans for years we will never see. How do two people who knew each other's every scar become strangers who pretend not to look when they cross paths?\n\nI do not hate you. That is the hardest part. If I hated you, this ache would have an edge. It is only quiet grief. I hope you find whatever you felt was missing in my love.` },
      { id: 2, time: 'Autumn evening', author: 'Sleepless night', title: 'The day you packed your things', preview: 'The closet looks too big now. The flat has echoes I never noticed...', tags: ['Empty spaces', 'Echoes'],
        content: `The closet looks twice as big now that your jackets are not crowding mine. There is an echo in this flat I never noticed when you were here.\n\nYou took your books, your mugs, your laundry basket. You left behind the sound of your laugh in the kitchen, the way you leaned on the counter waiting for the kettle, and every promise that started with "someday".\n\nFor three days I slept only on my side of the bed, because rolling over to the cold sheets felt like breaking my ribs again. I am slowly learning to breathe without checking whether you are breathing next to me.` },
      { id: 3, time: 'Dawn', author: 'A torn journal page', title: 'Why could love not be enough?', preview: 'They say strong love survives. But love did not save us from drifting apart...', tags: ['Acceptance', 'Grief', 'Letting go'],
        content: `They always say love conquers all. But love did not conquer the bad timing, the unspoken fears, the small resentments that grew like weeds while we both smiled and pretended we were fine.\n\nI loved you until my hands shook with it. I wanted to be the harbour you ran to. But you cannot save someone who is already looking for the exit.\n\nI am starting to accept that someone can be the love of a chapter without being the love of the whole book. Thank you for the chapter. It was the sweetest one I will ever read.` },
      { id: 4, time: 'Late night', author: 'Quiet solitude', title: 'Forgiving what was never apologised for', preview: 'Waiting for an apology was like keeping a wound open with my own fingernails...', tags: ['Healing', 'Peace', 'Moving on'],
        content: `I waited months for you to text and say you realised what you threw away. I replayed our last conversation a thousand times in the shower, looking for the sentence that could have fixed it.\n\nThen one evening, watching rain run down the window, I understood that you were not thinking about it at all. You were moving on while I built a museum out of our wreckage.\n\nSo tonight I forgive you. Not because you asked, but because I deserve peace in the rooms of my own mind. I release you from my future.` },
    ],
    healing: [
      'Crying is not weakness. It is your heart washing away the dust of what could not be.',
      'You did not lose your capacity to love. You proved how deeply and fearlessly you can give it.',
      'Healing is not a straight line. Some days you will feel free, and some days the smell of rain will bring tears. Both are progress.',
      'One day you will tell the story of how you survived this, and it will be someone else\'s survival guide.',
      'You are not empty. You are making room for a love that never asks you to beg to be chosen.',
    ],
    music: {
      greeting: 'Sit down. Breathe. Let the music do the talking.',
      greetingSub: 'There is no hurry here. Pick something gentle and it will keep playing while you sit in the room.',
      songsHead: 'A few gentle songs in English',
      otherLang: 'Looking for songs in Hindi or Telugu? Switch the language at the top.',
    },
    songNotes: {
      hLQl3WQQoQ0: 'For letting go of someone who has moved on.',
      k4V3Mo61fJM: 'A quiet hand on your shoulder when you are tired of being strong.',
      RBumgq5yVrA: 'About how you only see what you had once it is gone.',
    },
  },

  // ------------------------------------------------------------------ Hindi
  hi: {
    ui: {
      title: 'विरह कक्ष',
      subtitle: 'चुपचाप बैठने, अनकही बातें पढ़ने, बारिश सुनने और मन हल्का करने की जगह।',
      badge: 'मरहम',
      rainOn: 'बारिश सुनो', rainOff: 'बारिश बंद करो',
      tabs: { music: 'सुकून के गीत', letters: 'अनकहे ख़त', burn: 'जलाओ और छोड़ो', healing: 'दिलासा', art: 'चित्र' },
      lettersHead: 'रात की दराज़ में रखे ख़त',
      chord: 'उदास सुर छेड़ो',
      burnTitle: 'जलाओ और छोड़ो',
      burnIntro: 'जो कभी कह नहीं पाए, वो यहाँ लिख दो। मन भर जाए तो पन्ना जला दो और बोझ रात को सौंप दो।',
      burnHint: 'अपनी अलविदा यहाँ लिखो। इसे रात के सिवा कोई नहीं पढ़ेगा।',
      burnCount: 'अक्षर, निजी और कहीं सहेजे नहीं जाते',
      burnBtn: 'जलाओ और छोड़ दो', burnBusy: 'जल रहा है...',
      burnDoneTitle: 'तुम्हारे शब्द राख हो गए',
      burnDoneBody: 'तुमने सच्चे दिल से चाहा, इसमें शर्म की कोई बात नहीं। एक गहरी साँस लो। आज जो बोझ उतारा है, उसे कल फिर उठाना ज़रूरी नहीं।',
      burnAgain: 'एक और लिखो',
      healingHead: 'दिल को थोड़ी तसल्ली',
      artIntro: 'दीवार पर टँगा चित्र',
    },
    letters: [
      { id: 1, time: 'बारिश की आधी रात', author: 'रात दो बजे लिखा', title: 'चाय अब भी दो कप बनती है', preview: 'आज सुबह फिर आदत से दो कप चाय चढ़ा दी...', tags: ['आदत', 'याद', 'ख़ामोशी'],
        content: `आज सुबह फिर आदत से दो कप चाय चढ़ा दी। जब तक उबाल आया, याद आया कि तुम्हारे हिस्से का कप अब कोई नहीं पिएगा।\n\nहमने साथ बैठकर कितनी बारिशें देखी थीं। खिड़की वही है, बारिश भी वही, बस उसके सामने बैठने वाला कोई नहीं।\n\nतुमसे नाराज़गी नहीं है। नाराज़गी में भी एक रिश्ता बचा रहता है, और मेरे पास तो अब सिर्फ़ ख़ामोशी है। बस इतनी दुआ है कि तुम जहाँ भी रहो, तुम्हारी चाय गरम रहे।` },
      { id: 2, time: 'ट्रेन की खिड़की', author: 'सफ़र के बीच', title: 'वो शहर, वो गली', preview: 'गाड़ी तुम्हारे शहर में दो मिनट रुकी...', tags: ['शहर', 'यादें', 'सफ़र'],
        content: `गाड़ी तुम्हारे शहर के स्टेशन पर दो मिनट रुकी। बस दो मिनट, पर उतने में पूरा एक दौर आँखों के सामने से गुज़र गया: वो गली, वो चाट का ठेला, वो छत जहाँ हम घंटों बातें करते थे।\n\nमैं उतरी नहीं। उतरकर करती भी क्या, जिस दरवाज़े पर कभी तुम इंतज़ार करते थे, अब वहाँ किसी और का नाम लगा होगा।\n\nसीटी बजी, गाड़ी चल पड़ी। शहर पीछे छूट गया, पर वो गली आज भी साथ चल रही है।` },
      { id: 3, time: 'त्योहार की शाम', author: 'घर लौटकर', title: 'माँ को क्या बताऊँ', preview: 'घर पर सब पूछते हैं, वो कब आएगा...', tags: ['परिवार', 'चुप्पी', 'हिम्मत'],
        content: `घर पर सब पूछते हैं कि वो इस बार क्यों नहीं आया। मेरी हँसी बात बदल देती है, और माँ बस एक नज़र देखकर चुप हो जाती है। माँओं को सब पता होता है।\n\nरात को उन्होंने चुपचाप मेरी पसंद की खीर रख दी और कुछ नहीं पूछा। उस कटोरी में जितना प्यार था, उतना किसी सवाल में नहीं हो सकता था।\n\nमैं सोच रही हूँ कि शायद टूटने के बाद भी कोई जगह होती है जहाँ बिना बताए सब समझ लिया जाता है। वो जगह घर है।` },
      { id: 4, time: 'देर रात', author: 'छत पर बैठे हुए', title: 'माफ़ी जो कभी माँगी नहीं गई', preview: 'सोचा था एक दिन तुम लौटकर कहोगे, ग़लती मेरी थी...', tags: ['माफ़ी', 'सुकून', 'आगे बढ़ना'],
        content: `सोचा था एक दिन तुम लौटकर कहोगे कि ग़लती मेरी थी। महीनों उसी एक वाक्य के इंतज़ार में बीत गए।\n\nफिर एक शाम छत पर बैठे हुए समझ आया कि तुम तो कब के आगे बढ़ चुके हो, और मैं अब भी उस पुराने मोड़ पर खड़ी हूँ जहाँ तुमने हाथ छोड़ा था।\n\nटूटे हैं तो क्या, बिखरे नहीं हैं,\nदर्द है, पर हम ठहरे नहीं हैं।\n\nआज मैंने तुम्हें माफ़ किया। तुम्हारे लिए नहीं, अपने लिए, ताकि मन के कमरों में फिर से हवा आ सके।` },
    ],
    healing: [
      'रात कितनी भी लंबी हो, सुबह को आना ही पड़ता है। यह रात भी बीतेगी।',
      'जिसने चाहा है, उसने हारा नहीं है। दिल का इतना बड़ा होना कोई कमज़ोरी नहीं।',
      'दर्द का भी अपना मौसम होता है। जैसे सावन आकर चला जाता है, वैसे ही यह भी गुज़रेगा। तब तक रो लेना, मन धुल जाएगा।',
      'जो चला गया, वो तुम्हारी कमी नहीं थी। जो ठहरेगा, वो तुम्हें माँगना नहीं पड़ेगा।',
      'आज चाय अपने लिए बनाओ, अपनी पसंद का गीत लगाओ, और ख़ुद से कहो: मैं हूँ न।',
    ],
    music: {
      greeting: 'बैठो, गहरी साँस लो। गीत सब कह देंगे।',
      greetingSub: 'यहाँ कोई जल्दी नहीं है। कोई धीमा-सा गीत चुन लो, वह चलता रहेगा और तुम चुपचाप बैठे रहना।',
      songsHead: 'दर्द में डूबे कुछ सुकून भरे हिंदी गीत',
      otherLang: 'अंग्रेज़ी या तेलुगु गीत सुनने हों तो ऊपर भाषा बदल लो।',
    },
    songNotes: {
      '284Ov7ysmfA': 'जिसे चाहा उसे जाते हुए देखने का दर्द।',
      xRb8hxwN5zc: 'पास होकर भी दूर होने की कसक।',
      KwiDJclWo44: 'दिल की गहराई से निकली पुकार।',
    },
  },

  // ------------------------------------------------------------------ Telugu
  te: {
    ui: {
      title: 'విరహ గది',
      subtitle: 'ప్రశాంతంగా కూర్చుని, చెప్పలేని మాటలు చదివి, వాన శబ్దం వింటూ, మనసు తేలిక చేసుకునే చోటు.',
      badge: 'ఊరట',
      rainOn: 'వాన వినండి', rainOff: 'వాన ఆపండి',
      tabs: { music: 'ఓదార్పు పాటలు', letters: 'చెప్పని ఉత్తరాలు', burn: 'కాల్చి వదిలేయి', healing: 'ఊరట మాటలు', art: 'చిత్రం' },
      lettersHead: 'రాత్రి సొరుగులో ఉన్న ఉత్తరాలు',
      chord: 'విషాద స్వరం వినండి',
      burnTitle: 'కాల్చి వదిలేయి',
      burnIntro: 'ఎప్పుడూ చెప్పలేకపోయినవి ఇక్కడ రాయండి. మనసు సిద్ధమైనప్పుడు ఆ పేజీని కాల్చేసి, భారాన్ని రాత్రికి అప్పగించండి.',
      burnHint: 'మీ వీడ్కోలు ఇక్కడ రాయండి. రాత్రి తప్ప ఎవరూ చదవరు.',
      burnCount: 'అక్షరాలు, ఎవరికీ కనిపించవు, ఎక్కడా నిల్వ కావు',
      burnBtn: 'కాల్చి వదిలేయి', burnBusy: 'కాలుతోంది...',
      burnDoneTitle: 'మీ మాటలు బూడిదయ్యాయి',
      burnDoneBody: 'మీరు మనసారా ప్రేమించారు, అందులో సిగ్గుపడాల్సింది ఏమీ లేదు. ఒక లోతైన శ్వాస తీసుకోండి. ఈ రాత్రి దించిన భారాన్ని రేపు మళ్లీ మోయాల్సిన అవసరం లేదు.',
      burnAgain: 'ఇంకొకటి రాయండి',
      healingHead: 'మనసుకు చిన్న ఊరట',
      artIntro: 'గోడపై ఉన్న చిత్రం',
    },
    letters: [
      { id: 1, time: 'వాన కురిసిన అర్ధరాత్రి', author: 'రాత్రి 2 గంటలకు రాసింది', title: 'కాఫీ ఇంకా రెండు గ్లాసులే', preview: 'ఈ ఉదయం కాఫీ కలుపుతూ రెండు గ్లాసులు తీశాను...', tags: ['అలవాటు', 'జ్ఞాపకం', 'నిశ్శబ్దం'],
        content: `ఈ ఉదయం కాఫీ కలుపుతూ అలవాటుగా రెండు గ్లాసులు తీశాను. ఒకదాన్ని వెనక్కి పెట్టేసరికి గుండెల్లో ఏదో నొప్పి.\n\nమనం కలిసి చూసిన వానలన్నీ గుర్తొస్తున్నాయి. కిటికీ అదే, వాన అదే, పక్కన కూర్చునే మనిషే లేరు.\n\nనీ మీద కోపం లేదు. కోపం ఉంటే ఇంకా బంధం మిగిలి ఉన్నట్టే. నాకు మిగిలింది నిశ్శబ్దం మాత్రమే. నువ్వు ఎక్కడ ఉన్నా సంతోషంగా ఉండాలని కోరుకుంటున్నాను.` },
      { id: 2, time: 'సాయంత్రం బస్సు ప్రయాణం', author: 'ఊరికి వెళ్తూ', title: 'గోదావరి వంతెన మీద', preview: 'రాజమండ్రి వంతెన దాటుతుంటే గోదావరి మీద సాయంత్రం వెలుగు...', tags: ['ఊరు', 'జ్ఞాపకాలు', 'ప్రయాణం'],
        content: `బస్సు గోదావరి వంతెన దాటుతుంటే నది మీద సాయంత్రపు వెలుగు పడింది. ఒకప్పుడు ఇదే వంతెన మీద నీ చేయి పట్టుకుని నడిచాను. ఈ నది అప్పుడూ ఇలాగే మెరిసింది, అప్పుడు నా కళ్లల్లో కన్నీళ్లు లేవు అంతే.\n\nకిటికీ పక్కన కూర్చుని బయటకు చూస్తూనే ఉన్నాను. పక్క సీటులో ఎవరో నిద్రపోతున్నారు. ఈ ప్రపంచంలో ఎవరికీ తెలియదు, నా గుండెలో ఇంత పెద్ద వంతెన కూలిపోయిందని.\n\nనది ఆగదు. నేను కూడా ఆగను. కానీ ఈ వంతెన మీద ఒక్క క్షణం ఆగి నిన్ను తలచుకున్నాను.` },
      { id: 3, time: 'పండుగ రోజు సాయంత్రం', author: 'ఇంటికి వచ్చాక', title: 'అమ్మకు ఏమని చెప్పాలి', preview: 'అమ్మ ఫోన్ చేసి అడిగింది, అతను ఎలా ఉన్నాడు అని...', tags: ['కుటుంబం', 'మౌనం', 'ధైర్యం'],
        content: `అమ్మ ఫోన్ చేసి "అతను ఎలా ఉన్నాడు" అని అడిగినప్పుడల్లా నా నవ్వే సమాధానం చెప్పేస్తుంది. అమ్మ ఒక్క క్షణం మౌనంగా ఉండి, "భోజనం చేశావా" అని అడుగుతుంది. తల్లులకు అన్నీ తెలుసు.\n\nఈ రోజు ఇంటికి వస్తే, నాకు ఇష్టమైన పూర్ణం బూరెలు చేసి పెట్టింది, ఒక్క ప్రశ్న కూడా అడగలేదు. ఆ ప్లేటులో ఉన్నంత ప్రేమ ఏ ప్రశ్నలోనూ ఉండదు.\n\nవిరిగిపోయాక కూడా, చెప్పకుండానే అన్నీ అర్థం చేసుకునే ఒక చోటు ఉంటుంది. అదే ఇల్లు.` },
      { id: 4, time: 'అర్ధరాత్రి దాటాక', author: 'డాబా మీద కూర్చుని', title: 'అడగని క్షమాపణను క్షమించడం', preview: 'ఒక రోజు నువ్వు వచ్చి తప్పు నాదే అంటావని అనుకున్నాను...', tags: ['క్షమ', 'ప్రశాంతత', 'ముందుకు సాగడం'],
        content: `ఏదో ఒక రోజు నువ్వు వచ్చి "తప్పు నాదే" అంటావని అనుకున్నాను. ఆ ఒక్క మాట కోసం నెలలు గడిచిపోయాయి.\n\nఒక సాయంత్రం డాబా మీద కూర్చున్నప్పుడు అర్థమైంది, నువ్వు ఎప్పుడో ముందుకు వెళ్లిపోయావు, నేను మాత్రం నువ్వు చేయి వదిలిన ఆ మలుపులోనే ఇంకా నిలబడి ఉన్నాను.\n\nగాయం మానుతుంది, గుర్తు మాత్రం మిగులుతుంది,\nగుర్తు ఉన్నా సరే, జీవితం సాగుతుంది.\n\nఈ రోజు నిన్ను క్షమించాను. నీ కోసం కాదు, నా కోసం, నా మనసు గదుల్లోకి మళ్లీ గాలి రావడానికి.` },
    ],
    healing: [
      'ప్రతి రాత్రి తర్వాత ఒక ఉదయం ఉంటుంది. ఈ రాత్రి కూడా గడిచిపోతుంది.',
      'ప్రేమించడం ఓటమి కాదు. అంత పెద్ద మనసు ఉండటం బలహీనత కాదు.',
      'బాధకు కూడా ఒక కాలం ఉంటుంది. వానాకాలం వచ్చి వెళ్లినట్టే ఇదీ గడిచిపోతుంది. అప్పటి వరకు ఏడవండి, మనసు కడిగినట్టు అవుతుంది.',
      'వెళ్లిపోయింది మీ లోపం కాదు. నిలిచేవారిని మీరు అడుక్కోవాల్సిన అవసరం ఉండదు.',
      'ఈ రోజు మీ కోసం ఒక కప్పు కాఫీ కలుపుకోండి, మీకు ఇష్టమైన పాట పెట్టుకోండి, మీకు మీరే చెప్పుకోండి: నేను ఉన్నాను.',
    ],
    music: {
      greeting: 'కూర్చోండి, లోతుగా శ్వాస తీసుకోండి. పాటలే అన్నీ చెబుతాయి.',
      greetingSub: 'ఇక్కడ తొందర ఏమీ లేదు. నెమ్మదైన ఒక పాట ఎంచుకోండి, అది వినిపిస్తూనే ఉంటుంది, మీరు ప్రశాంతంగా కూర్చోండి.',
      songsHead: 'మనసును తాకే కొన్ని తెలుగు పాటలు',
      otherLang: 'ఇంగ్లీష్ లేదా హిందీ పాటలు కావాలంటే పైన భాష మార్చండి.',
    },
    songNotes: {
      BpINyS4k7Uw: 'ఇంకా ప్రేమిస్తున్న వారిని మిస్ అయ్యే బాధ.',
      kca0cG9fiQw: 'మాట వినని మనసు, ఎదురుచూసే గుండె.',
      sNKD014uRj0: 'తొలి ప్రేమను మెల్లగా గుర్తు చేసుకోవడం.',
    },
  },
};

// A hand-picked Spotify playlist per language. Each was checked against Spotify's own
// oEmbed endpoint when it was added.
export const SPOTIFY_PLAYLISTS = {
  en: [{ id: '37i9dQZF1DX7qK8ma5wgG1', title: 'Sad Songs' }],
  hi: [{ id: '37i9dQZF1DXdFesNN9TzXT', title: 'Sad Hindi Melodies' }, { id: '2GrnA8IlKRBKNs8vgRHzGq', title: 'Sad Hindi Songs' }],
  te: [{ id: '0jxeTEE65lep3L2BnxRs48', title: 'Telugu Broken Songs' }, { id: '4QUArRyv9Ltw8cwwap8wkI', title: 'Sad Love Songs in Telugu' }],
};
