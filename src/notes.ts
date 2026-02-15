import { Hono } from "hono";
import * as essays from "./content";
import { searchEntriesHybrid } from "./search";

type Bindings = {
  DB: D1Database;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  API_KEY: string;
};

// ---------------------------------------------------------------------------
// Note definitions
// ---------------------------------------------------------------------------

interface Note {
  slug: string;
  title: string;
  description: string;
  intro: string;
  /** Optional: raw HTML essay content (trusted, rendered directly without escaping). */
  content?: string;
  searchQueries: string[];
  faqs: { question: string; answer: string }[];
  relatedSlugs: string[];
  /** Entries to always show first, fetched from D1 and prepended before semantic search results. */
  pinnedEntries?: { source: string; book: number; entry: string }[];
}

const NOTES: Note[] = [
  {
    slug: "stoicism-and-anxiety",
    title: "Stoicism and Anxiety",
    description:
      "What the Stoics said about worry, fear, and finding calm. Practical Stoic wisdom from Marcus Aurelius and Epictetus for managing anxiety.",
    intro:
      "Anxiety is the mind projecting itself into an uncertain future. The Stoics understood this over two thousand years ago. Marcus Aurelius, writing in his journal during military campaigns and plague, returned again and again to a simple insight: most of what we fear never happens, and what does happen can be endured. Epictetus taught that anxiety arises not from events themselves, but from our judgments about them. Below are passages from the Meditations, Discourses, and Enchiridion that speak directly to the anxious mind.",
    searchQueries: [
      "anxiety worry fear",
      "troubled mind calm",
      "inner peace tranquility",
      "what you can control",
      "letting go of worry",
    ],
    faqs: [
      {
        question: "Does Stoicism reduce anxiety?",
        answer:
          "Yes. Stoicism offers practical techniques for reducing anxiety by shifting focus from what we cannot control to what we can. The core Stoic practice is the dichotomy of control, taught by Epictetus in the Enchiridion: examine whether the thing causing anxiety is within your power. If it is, act. If not, let it go. Marcus Aurelius practiced this daily in his Meditations, reminding himself that most fears are about things that have not yet happened and may never happen.",
      },
      {
        question: "How do Stoics deal with anxiety?",
        answer:
          "Stoics deal with anxiety through a combination of practices: examining their judgments (is this truly bad, or am I adding unnecessary interpretation?), focusing only on what is within their control, and practicing negative visualization to prepare for the worst so it loses its power to frighten. Epictetus teaches in the Discourses that our disturbance comes not from things, but from our opinions about things. Marcus Aurelius repeatedly reminds himself in the Meditations to return to the present moment rather than projecting into an uncertain future.",
      },
      {
        question:
          "What are the 5 Stoic practices to calm your anxiety?",
        answer:
          "Five key Stoic practices for calming anxiety are: (1) the dichotomy of control \u2014 distinguish what is up to you from what is not; (2) negative visualization (premeditatio malorum) \u2014 briefly imagine the worst to defuse fear\u2019s grip; (3) present-moment awareness \u2014 Marcus Aurelius reminds himself to stay with what is, not what might be; (4) examining impressions \u2014 Epictetus teaches to question every anxious thought before accepting it; and (5) the view from above \u2014 zoom out to see your worries in the context of all of time and space.",
      },
      {
        question: "What is the Stoic mantra for anxiety?",
        answer:
          "The closest thing to a Stoic mantra for anxiety comes from Epictetus: \u201cIt is not things that disturb us, but our judgments about things.\u201d This single line from the Enchiridion captures the entire Stoic approach to anxiety. Marcus Aurelius echoes this throughout the Meditations, reminding himself that he has the power to remove any disturbance by changing how he perceives it. The disturbance is never in the event \u2014 it is always in the interpretation.",
      },
      {
        question: "What does Marcus Aurelius say about anxiety?",
        answer:
          "Marcus Aurelius addresses anxiety throughout the Meditations. He reminds himself not to be troubled about the future, to focus on the present task, and that most of what we fear is a product of the imagination rather than reality. He writes about the shortness of life as a reason not to waste time worrying, and about accepting nature\u2019s course rather than resisting it. His approach is consistently practical: identify the worry, ask whether it is within your control, and if not, return your attention to what you can do right now.",
      },
      {
        question: "What does Epictetus say about anxiety?",
        answer:
          "Epictetus\u2019s core teaching is that we suffer not from events but from our judgments about them. In the Discourses and Enchiridion, he argues that anxiety comes from wanting things outside our control to be different. His prescription is radical: confine your desires and aversions only to things within your power \u2014 your choices, your character, your responses. Everything else \u2014 health, reputation, outcomes \u2014 is \u201cnot up to us.\u201d Once you truly accept this, he teaches, anxiety loses its foundation.",
      },
    ],
    relatedSlugs: [
      "stoicism-and-grief",
      "stoicism-and-resilience",
      "stoicism-and-control",
    ],
  },
  {
    slug: "stoicism-and-grief",
    title: "Stoicism and Grief",
    description:
      "How the Stoics approached loss, death, and mourning. Wisdom from Marcus Aurelius and Epictetus on processing grief.",
    intro:
      "Stoicism does not ask you to suppress grief. It asks you to understand it. Marcus Aurelius lost multiple children and wrote the Meditations while surrounded by death during plague and war. Epictetus, who was born into slavery, taught that accepting impermanence is the foundation of inner freedom. Their writings offer not emotional numbness, but a framework for facing loss honestly.",
    searchQueries: [
      "grief loss mourning",
      "death impermanence acceptance",
      "losing someone loved",
      "coping with loss",
    ],
    faqs: [
      {
        question: "Can Stoicism help with grief?",
        answer:
          "Yes, but not in the way people often assume. Stoicism does not ask you to suppress grief or pretend loss does not hurt. It offers a framework for processing it. Marcus Aurelius, who buried multiple children, reminds himself throughout the Meditations that all things are impermanent and that loss is a form of change \u2014 the same change that governs all of nature. Epictetus teaches that while we cannot control what happens, we can choose not to let grief consume us entirely. The Stoic approach is to grieve honestly while remembering that the person you lost would not want you to destroy yourself in mourning.",
      },
      {
        question: "Do Stoics mourn?",
        answer:
          "Absolutely. The Stoics never taught emotional suppression. Marcus Aurelius grieved openly for the people he lost, and his Meditations are full of reflections on death and impermanence. Epictetus draws a distinction between natural grief \u2014 which is a healthy response to loss \u2014 and excessive grief, which becomes a judgment that the universe should have been different. The Stoic mourns, but returns to the insight that the loved one was borrowed, not owned, and that gratitude for what was shared is more fitting than despair over what ended.",
      },
      {
        question: "What did Marcus Aurelius say about grief?",
        answer:
          "Marcus Aurelius returns to themes of loss and death throughout the Meditations. He reminds himself that everything is transient \u2014 people, reputations, empires. He reflects on the generations who lived before him, all now forgotten, as a way to put his own grief in perspective. Rather than seeing death as tragic, he frames it as natural, part of the same process that brought the person into existence. His approach is not cold but realistic: accept the loss, honor what was, and return your attention to living well in the present.",
      },
      {
        question: "What did Epictetus say about grief?",
        answer:
          "Epictetus addresses grief with his characteristic directness. In the Enchiridion, he teaches that when we lose someone, we should remind ourselves that they were mortal \u2014 that we knew this all along. He uses the metaphor of returning something borrowed: we never truly owned the people we love, and their departure is a return to nature. In the Discourses, he acknowledges that grief is natural but warns against turning it into a story about how life is unfair. The goal is not to feel nothing, but to grieve without being destroyed.",
      },
      {
        question: "How do Stoics deal with the death of a loved one?",
        answer:
          "Stoics prepare for loss through a practice called negative visualization (premeditatio malorum): briefly contemplating that the people you love will one day die, so that you cherish them more fully now and are not completely blindsided when it happens. When loss does come, they grieve \u2014 but they also practice reframing. Marcus Aurelius reminds himself that death is not evil, merely change. Epictetus suggests focusing on gratitude for the time shared rather than resentment for the time lost. Both emphasize returning to your duties and living in a way that honors the dead.",
      },
      {
        question: "Is it unhealthy to be Stoic about grief?",
        answer:
          "Only if you mistake Stoicism for emotional suppression. The ancient Stoics never advocated for bottling up feelings. They taught the opposite: examine your grief, understand it, and then choose how to respond. Marcus Aurelius\u2019s Meditations are deeply personal and emotional. Epictetus acknowledges the pain of loss explicitly. What Stoicism warns against is not grief itself, but allowing grief to become a permanent state that prevents you from living. The Stoic approach is to feel fully, then find your footing again.",
      },
    ],
    relatedSlugs: [
      "stoicism-and-anxiety",
      "stoicism-and-resilience",
      "stoicism-and-relationships",
    ],
  },
  {
    slug: "stoicism-and-anger",
    title: "Stoicism and Anger",
    description:
      "The Stoic approach to anger management. What Marcus Aurelius and Epictetus teach about handling rage and frustration.",
    intro:
      "Anger was one of the passions the Stoics studied most carefully. Marcus Aurelius returns to it throughout the Meditations, reminding himself that the best response to provocation is not retaliation but understanding. Epictetus teaches in the Discourses that anger is a choice \u2014 a judgment that someone has wronged us \u2014 and that we can revoke that judgment. Their writings offer a surprisingly modern approach to anger management.",
    searchQueries: [
      "anger frustration rage",
      "patience responding to provocation",
      "dealing with difficult people",
      "controlling temper",
    ],
    faqs: [
      {
        question: "How does a Stoic handle anger?",
        answer:
          "A Stoic handles anger by pausing before reacting and examining the judgment behind the emotion. Epictetus teaches in the Enchiridion that anger arises from the belief that someone has wronged us \u2014 but that belief is a judgment we add to the event, not the event itself. Marcus Aurelius practices this throughout the Meditations: when provoked, he reminds himself that the other person is acting from ignorance, not malice, and that responding with anger only harms the one who is angry. The Stoic approach is not to suppress anger but to dissolve it at its root by questioning the interpretation.",
      },
      {
        question: "How would a Stoic view feelings of anger?",
        answer:
          "Stoics view anger as a mistaken judgment \u2014 specifically, the judgment that someone has deliberately wronged you and that retaliation is appropriate. Epictetus teaches in the Discourses that anger reveals what we falsely believe is ours to control: other people\u2019s behavior, their opinions, their actions. Marcus Aurelius reminds himself that angry people are suffering too, and that understanding their perspective dissolves the impulse to retaliate. Anger is not denied or suppressed \u2014 it is examined and, through examination, released.",
      },
      {
        question: "What did Marcus Aurelius say about anger?",
        answer:
          "Marcus Aurelius addresses anger more than almost any other topic in the Meditations. His strategy is consistent: when someone provokes you, remind yourself that they are acting according to their own understanding, however flawed. He asks himself whether the offense will matter in a day, a year, a lifetime. He reminds himself that angry retaliation degrades his own character more than the original offense. His most practical advice is to consider what virtue the situation calls for \u2014 patience, understanding, forgiveness \u2014 and apply it instead of giving in to rage.",
      },
      {
        question: "What is the root cause of anger?",
        answer:
          "According to the Stoics, the root cause of anger is not the external event but our judgment about it. Epictetus states this clearly: it is not things that disturb us, but our opinions about things. When someone insults you, the insult itself is neutral \u2014 it is your belief that you have been wronged and that the wrong matters that produces the anger. Marcus Aurelius adds another layer: anger often comes from expecting others to behave according to our standards, which is itself a form of wanting to control what is not ours to control.",
      },
      {
        question: "What are the Stoic techniques for anger management?",
        answer:
          "The Stoics offer several practical techniques: (1) the pause \u2014 Epictetus teaches to wait before responding to any provocation, giving reason time to replace impulse; (2) perspective-taking \u2014 Marcus Aurelius regularly considers the other person\u2019s point of view and asks whether they acted from malice or ignorance; (3) the mortality check \u2014 both will be dead soon, so is this worth the energy?; (4) reframing \u2014 treat the provocation as training for patience and self-mastery; and (5) examining the judgment \u2014 question whether the belief producing the anger is actually true.",
      },
      {
        question: "How to let go of intense anger?",
        answer:
          "The Stoics recommend working on the judgment behind the anger rather than the emotion itself. Epictetus teaches that once you remove the judgment \u2014 the belief that you were wronged in a way that matters \u2014 the anger naturally subsides. Marcus Aurelius suggests zooming out: view the situation from above, consider how brief life is, ask how many people throughout history have burned with anger over things now completely forgotten. He also practices empathy, imagining himself in the other person\u2019s position, which shifts the response from retaliation to understanding. The anger dissolves not by being forced away, but by being seen clearly.",
      },
    ],
    relatedSlugs: [
      "stoicism-and-anxiety",
      "stoicism-and-relationships",
      "stoicism-at-work",
    ],
  },
  {
    slug: "how-to-practice-stoicism",
    title: "How to Practice Stoicism",
    description:
      "A practical guide to Stoic exercises and daily routines. Learn from Marcus Aurelius's daily practice and Epictetus's teachings.",
    intro:
      "Stoicism is not a philosophy to read about. It is a philosophy to practice. Marcus Aurelius wrote the Meditations as a daily exercise \u2014 a way of training his mind each morning and evening. Epictetus structured his teaching around practical exercises: examining impressions, rehearsing difficulties, distinguishing what is up to us from what is not. Here is what their practice looked like, drawn directly from the texts.",
    searchQueries: [
      "daily practice routine exercise",
      "how to live well",
      "self discipline training",
      "morning evening reflection",
      "philosophical practice habit",
    ],
    faqs: [
      {
        question: "How can I start practicing Stoicism?",
        answer:
          "Start where Epictetus starts: with the dichotomy of control. Each morning, remind yourself what is within your power (your judgments, your choices, your effort) and what is not (other people\u2019s behavior, external outcomes, the past). Marcus Aurelius began every day by anticipating difficulties \u2014 he would tell himself that he would encounter ungrateful, arrogant, and dishonest people, and prepare his response in advance. You can begin with just two minutes of morning reflection: what is within my control today, and what do I need to let go of?",
      },
      {
        question: "How can I apply Stoicism daily?",
        answer:
          "Marcus Aurelius applied Stoicism by writing in his journal every day \u2014 that is literally what the Meditations are. You can follow the same practice: write briefly each morning about how you intend to respond to the day\u2019s challenges, and each evening about what went well and what you could improve. Throughout the day, practice Epictetus\u2019s core exercise: when something disturbs you, pause and ask whether the disturbance comes from the event or from your judgment about it. Apply the dichotomy of control to every frustration, and you are already practicing Stoicism.",
      },
      {
        question: "What are the Stoic exercises?",
        answer:
          "The main Stoic exercises drawn from the texts are: (1) morning preparation \u2014 Marcus Aurelius rehearses difficulties before they arise so they do not catch him off guard; (2) evening review \u2014 reflecting on the day\u2019s actions and judgments; (3) negative visualization (premeditatio malorum) \u2014 briefly imagining loss or hardship to cultivate gratitude and resilience; (4) examining impressions \u2014 Epictetus\u2019s practice of questioning every initial reaction before accepting it; (5) the view from above \u2014 imagining your life from a cosmic perspective to reduce the weight of trivial concerns; and (6) the dichotomy of control \u2014 continuously sorting what is up to you from what is not.",
      },
      {
        question: "What was Marcus Aurelius\u2019s daily routine?",
        answer:
          "Marcus Aurelius\u2019s Meditations give us a window into his routine. He wrote early in the morning, often reminding himself of the kind of people he would encounter and the virtues he would need. He reflected on impermanence, duty, and gratitude. Throughout the day, as emperor, he dealt with governance, legal disputes, and military decisions \u2014 always returning to Stoic principles to keep himself steady. The Meditations are essentially his evening and morning journal, a practice of self-examination that he used to align his actions with his philosophy.",
      },
      {
        question: "What is Stoic journaling?",
        answer:
          "Stoic journaling is the practice of writing to examine your thoughts, judgments, and actions \u2014 exactly as Marcus Aurelius did in the Meditations. It is not diary-keeping. It is self-examination. A typical entry might ask: What disturbed me today? Was my reaction proportionate? Did I focus on what I could control? Epictetus encouraged his students to review their day each evening, noting where they succeeded and where they fell short. The goal is not self-criticism but honest self-awareness \u2014 catching bad judgments before they become habits.",
      },
      {
        question: "How do beginners practice Stoicism?",
        answer:
          "Beginners should start with three simple practices. First, read one passage from the Meditations or Enchiridion each morning and sit with it for a moment. Second, practice the dichotomy of control throughout the day: whenever you feel frustrated or anxious, ask yourself whether the thing bothering you is within your power to change. Third, do a brief evening reflection \u2014 three minutes reviewing what went well and where you reacted poorly. These are not modern inventions; they are exactly the practices that Epictetus assigned to his students and that Marcus Aurelius performed daily.",
      },
    ],
    relatedSlugs: [
      "stoicism-and-control",
      "stoicism-at-work",
      "stoicism-and-resilience",
    ],
  },
  {
    slug: "stoicism-and-resilience",
    title: "Stoicism and Resilience",
    description:
      "Building mental toughness through Stoic philosophy. Memento mori, adversity, and the Stoic approach to hardship.",
    intro:
      "The Meditations were written during the Antonine Plague and the Marcomannic Wars. Marcus Aurelius did not philosophize from comfort \u2014 he wrote from the frontier, surrounded by death. Epictetus, a former slave, taught that hardship is not an obstacle to the good life but its raw material. Resilience, in the Stoic view, is not about enduring pain silently. It is about seeing adversity clearly and choosing your response.",
    searchQueries: [
      "adversity hardship obstacle",
      "resilience strength endurance",
      "memento mori death mortality",
      "overcoming difficulty suffering",
    ],
    faqs: [
      {
        question: "Are Stoics resilient?",
        answer:
          "Resilience is perhaps the defining Stoic trait. Marcus Aurelius wrote the Meditations during plague, war, and personal loss \u2014 not from a place of comfort, but from the frontier. His entire practice was about maintaining clarity and purpose under extreme pressure. Epictetus, who lived as a slave before becoming a philosopher, taught that hardship is not the enemy of a good life but its training ground. The four Stoic virtues \u2014 wisdom, courage, justice, and temperance \u2014 are each a form of resilience: the ability to act well regardless of circumstances.",
      },
      {
        question: "What is the difference between Stoicism and resilience?",
        answer:
          "Modern resilience is often understood as the ability to bounce back from adversity. Stoic resilience goes further: it is the ability to use adversity as fuel for growth. Marcus Aurelius writes that the obstacle in the path becomes the path \u2014 that impediments to action advance action. This is not mere recovery; it is transformation. Epictetus teaches the same principle: every difficulty is an opportunity to practice virtue. Where modern resilience says \u201csurvive the storm,\u201d Stoicism says \u201cbecome the kind of person for whom storms are training.\u201d",
      },
      {
        question: "How do Stoics stay calm?",
        answer:
          "Stoic calm comes from a specific mental discipline: separating events from judgments about events. When something happens, the Stoic pauses and asks, \u201cIs this within my control?\u201d If yes, act. If no, accept. Marcus Aurelius practiced this rigorously, reminding himself that most disturbances come not from things but from his opinions about things. Epictetus puts it even more directly: you are disturbed not by what happens to you, but by your reaction to what happens. Stoic calm is not passive \u2014 it is the result of constant, deliberate practice.",
      },
      {
        question: "What did Marcus Aurelius say about resilience?",
        answer:
          "Marcus Aurelius never uses the word \u201cresilience,\u201d but the concept runs through every book of the Meditations. He reminds himself that difficulties are natural, that pain is endurable, and that the mind can remain its own master regardless of what the body or the world throws at it. He writes about converting obstacles into opportunities and about remembering that every person before him faced similar struggles and came through \u2014 or did not, and was forgotten. His message is consistent: your response to hardship is the only thing that matters.",
      },
      {
        question: "What is the meaning of memento mori?",
        answer:
          "Memento mori \u2014 \u201cremember that you will die\u201d \u2014 is a Stoic practice for building resilience and gratitude. Marcus Aurelius returns to it throughout the Meditations: he lists the names of emperors, philosophers, and generals who are now dust, reminding himself that the same fate awaits him. The point is not morbid fixation but clarity. When you remember that your time is limited, trivial frustrations lose their power, and you are free to focus on what genuinely matters. Epictetus teaches the same: keep death in front of you, and you will never think a small thought or hold a petty grudge.",
      },
      {
        question: "How can Stoicism help you through tough times?",
        answer:
          "Stoicism provides a framework for tough times that is both practical and philosophical. First, it tells you to focus only on what you can control \u2014 your response, your effort, your character \u2014 and release everything else. This alone removes a large portion of the suffering that comes from fighting reality. Second, it reframes adversity as material for growth: Marcus Aurelius writes that what stands in the way becomes the way. Third, it offers the practice of negative visualization \u2014 having already contemplated the worst, you are less shattered when it arrives. These are not abstract ideas; they are daily tools used by people facing real hardship.",
      },
    ],
    relatedSlugs: [
      "stoicism-and-grief",
      "stoicism-and-anxiety",
      "stoicism-and-control",
    ],
  },
  {
    slug: "stoicism-and-relationships",
    title: "Stoicism and Relationships",
    description:
      "What the Stoics teach about love, empathy, and dealing with others. Stoicism is deeply social, not emotionally cold.",
    intro:
      "A common misconception is that Stoics are emotionally cold. In fact, Marcus Aurelius opens the Meditations with an entire book of gratitude \u2014 thanking family, teachers, and friends for shaping his character. Epictetus taught that we are social beings with duties to others. The Stoic approach to relationships is not about detachment, but about loving without clinging, helping without controlling, and accepting others as they are.",
    searchQueries: [
      "love relationships empathy",
      "dealing with difficult people",
      "social duty community others",
      "family friendship gratitude",
    ],
    faqs: [
      {
        question: "Do Stoic people fall in love?",
        answer:
          "Yes. Marcus Aurelius writes with deep affection about his wife, his children, his teachers, and his friends. The entire first book of the Meditations is a love letter to the people who shaped him \u2014 he thanks each one by name for specific qualities they gave him. Epictetus teaches that human beings are naturally social and that our relationships are among our most important duties. The Stoic does not avoid love; the Stoic loves without clinging, without trying to control the other person, and without demanding that the relationship be permanent. This is not less love \u2014 it is more honest love.",
      },
      {
        question: "Is Stoicism against empathy?",
        answer:
          "No. This is one of the most persistent misconceptions about Stoicism. Marcus Aurelius constantly practices empathy in the Meditations \u2014 he imagines himself in the position of people who frustrate him, trying to understand why they act as they do. Epictetus teaches that we are all part of one human community and that treating others with understanding is a core duty. What Stoicism warns against is not empathy but emotional contagion \u2014 being so overwhelmed by someone else\u2019s distress that you cannot help them. The Stoic aims to understand deeply while remaining clear-headed enough to act.",
      },
      {
        question: "How do Stoics view relationships?",
        answer:
          "Stoics view relationships as one of life\u2019s central purposes. Epictetus teaches that we exist in a web of roles \u2014 parent, child, partner, neighbor, citizen \u2014 and that fulfilling these roles well is the practice of justice, one of the four cardinal virtues. Marcus Aurelius reminds himself that human beings are made for cooperation and that isolating yourself from others contradicts nature. The Stoic approach to relationships is practical: accept people as they are, do not try to change them, fulfill your duties toward them, and remember that every relationship is temporary.",
      },
      {
        question: "How do Stoics deal with a toxic relationship?",
        answer:
          "The Stoics offer clear guidance on difficult people. Marcus Aurelius begins many entries by acknowledging that he will encounter selfish, ungrateful, and dishonest people \u2014 and then reminds himself that they act from ignorance, not malice. His approach is to respond with patience and to avoid becoming like them. Epictetus teaches that you cannot control another person\u2019s behavior, only your response to it. The Stoic stays in a relationship as long as duty and justice require, but does not sacrifice inner peace to another person\u2019s dysfunction. Setting boundaries is itself a Stoic act \u2014 it is choosing what is within your control.",
      },
      {
        question: "Does Stoicism lack empathy?",
        answer:
          "The opposite is true. Marcus Aurelius\u2019s Meditations are full of deliberate empathy practice. When someone wrongs him, he pauses and imagines their perspective \u2014 what beliefs, fears, or pressures led them to act that way. He reminds himself that they are fellow human beings and that he himself has committed similar errors. Epictetus teaches that understanding others is essential to living well in community. Stoicism lacks sentimentality, not empathy. It replaces emotional reactivity with genuine understanding \u2014 which is actually a deeper, more useful form of empathy.",
      },
      {
        question: "How to deal with a Stoic person in a relationship?",
        answer:
          "First, understand that true Stoicism is not emotional coldness. A genuinely Stoic partner is trying to respond thoughtfully rather than react impulsively, to accept what they cannot change, and to focus on their own behavior rather than trying to control yours. If your partner seems distant, it may help to know that Marcus Aurelius emphasizes showing up for others as a duty of love, not avoiding them. The best approach is direct communication: Stoics respect honesty and clear expression of needs. Ask for what you need directly rather than expecting them to read emotional cues.",
      },
    ],
    relatedSlugs: [
      "stoicism-and-anger",
      "stoicism-and-grief",
      "how-to-practice-stoicism",
    ],
  },
  {
    slug: "stoicism-at-work",
    title: "Stoicism at Work",
    description:
      "Applying Stoic philosophy in the workplace. Discipline, leadership, and handling professional challenges the Stoic way.",
    intro:
      "Marcus Aurelius ran the Roman Empire. His Meditations are, in a sense, the journal of a leader managing impossible responsibilities during crisis. Epictetus taught students who would go on to hold public office. Their writings are full of practical wisdom about duty, discipline, dealing with difficult colleagues, and finding meaning in daily work \u2014 not by seeking praise, but by doing the work itself well.",
    searchQueries: [
      "work duty discipline",
      "leadership responsibility",
      "dealing with colleagues professionally",
      "perseverance effort purpose",
    ],
    faqs: [
      {
        question: "How to be Stoic in the workplace?",
        answer:
          "Start with the dichotomy of control applied to work: you control the quality of your effort, your attitude, and how you treat colleagues. You do not control outcomes, promotions, or other people\u2019s opinions of you. Marcus Aurelius managed the Roman Empire using this exact framework \u2014 focusing on doing his duty well without being attached to recognition. Epictetus teaches that your job is to perform your role excellently, not to worry about how it is received. In practice, this means showing up with full effort, staying calm under pressure, and not letting office politics distract you from the work itself.",
      },
      {
        question: "What did Marcus Aurelius say about work?",
        answer:
          "Marcus Aurelius writes extensively about duty and effort in the Meditations. He reminds himself not to be reluctant in doing what his role requires \u2014 even when he is tired, even when the work seems thankless. He compares himself to a vine that produces grapes: it does not ask for recognition, it simply does what it was made to do. He also warns against procrastination, telling himself that each day is limited and that putting off meaningful work is a form of disrespecting his own life. His message is clear: do the work, do it now, and let the results take care of themselves.",
      },
      {
        question: "What are the three Stoic disciplines?",
        answer:
          "Epictetus organizes Stoic practice into three disciplines: the discipline of desire (learning to want only what is within your control and to accept everything else), the discipline of action (fulfilling your duties to others with justice and care), and the discipline of assent (examining your initial impressions before accepting them as true). At work, these translate directly: desire only to do your best, act with fairness toward colleagues, and question your snap judgments about situations before reacting. Marcus Aurelius practices all three throughout the Meditations without naming them explicitly.",
      },
      {
        question: "How to build self-discipline the Stoic way?",
        answer:
          "Marcus Aurelius built discipline through daily practice. Each morning he prepared himself for the day\u2019s difficulties. Each evening he reviewed his actions. He treated discomfort as training rather than punishment. Epictetus taught his students to start with small exercises in self-denial \u2014 choosing the harder option when the easier one would have been fine \u2014 to build the muscle of self-control. The Stoic approach to discipline is not willpower through gritted teeth; it is habit formation through repeated practice, reinforced by the understanding that discipline is freedom, not restriction.",
      },
      {
        question: "How to handle disrespect in Stoicism?",
        answer:
          "Marcus Aurelius\u2019s response to disrespect is consistent throughout the Meditations: consider the source, assume ignorance rather than malice, and remember that your character is not determined by how others treat you. Epictetus is even more direct: if someone insults you, the insult only lands if you accept it. He compares it to someone offering you a gift \u2014 you can choose not to take it. In the workplace, this means not retaliating, not gossiping, and not allowing someone else\u2019s poor behavior to degrade your own. Your response to disrespect is entirely within your control; the disrespect itself is not.",
      },
      {
        question: "How to not let work consume you?",
        answer:
          "The Stoics valued duty but also perspective. Marcus Aurelius reminds himself repeatedly that all the emperors before him \u2014 with all their ambitions and achievements \u2014 are now dust. This is not defeatism; it is freedom. When you remember that your career is temporary, you stop sacrificing your health and relationships for outcomes you cannot control. Epictetus teaches that your work is to do your role well, not to identify with it completely. The Stoic works diligently but holds the results lightly, knowing that what matters most is not the output but the character you bring to the effort.",
      },
    ],
    relatedSlugs: [
      "how-to-practice-stoicism",
      "stoicism-and-resilience",
      "stoicism-and-anger",
    ],
  },
  {
    slug: "stoicism-and-control",
    title: "Control and Acceptance",
    description:
      "The dichotomy of control and amor fati: the two pillars of Stoic acceptance. Epictetus's core teaching and Marcus Aurelius on fate.",
    intro:
      "The most famous line in Stoic philosophy opens Epictetus\u2019s Enchiridion: some things are within our power, and some things are not. This single distinction \u2014 the dichotomy of control \u2014 is the foundation of everything that follows. Marcus Aurelius builds on this with amor fati, the love of fate: not merely accepting what happens, but embracing it as necessary. Together, these two ideas form the beating heart of Stoic practice.",
    searchQueries: [
      "control acceptance what is up to us",
      "fate providence amor fati",
      "letting go attachment",
      "dichotomy of control Epictetus",
      "accept what you cannot change",
    ],
    faqs: [
      {
        question: "What is the dichotomy of control?",
        answer:
          "The dichotomy of control is the foundational Stoic teaching, stated by Epictetus in the opening line of the Enchiridion: some things are within our power, and some things are not. Within our power are our opinions, desires, aversions, and actions \u2014 in short, everything that is our own doing. Not within our power are our bodies, possessions, reputations, and positions \u2014 everything that is not our own doing. The entire Stoic practice flows from this one distinction. When you focus your energy only on what you can control, anxiety, anger, and frustration lose most of their grip.",
      },
      {
        question: "What does amor fati mean?",
        answer:
          "Amor fati means \u201clove of fate.\u201d It is the Stoic practice of not merely accepting what happens but embracing it as necessary and good. Marcus Aurelius expresses this throughout the Meditations when he writes about welcoming whatever nature brings and seeing every event as part of a larger order. It goes beyond resignation: where acceptance says \u201cI can live with this,\u201d amor fati says \u201cthis is exactly what I needed.\u201d The practice transforms obstacles into opportunities and setbacks into material for growth.",
      },
      {
        question: "How do you practice the dichotomy of control?",
        answer:
          "Epictetus teaches a simple daily exercise: whenever something disturbs you, pause and ask, \u201cIs this within my control?\u201d If it is \u2014 your effort, your response, your judgment \u2014 then act on it. If it is not \u2014 another person\u2019s behavior, the weather, the outcome of an event \u2014 then let it go. Marcus Aurelius practiced this constantly in the Meditations, reminding himself to focus on the present task rather than worrying about future outcomes. The key is making this a habit through repetition: every frustration is a chance to practice the distinction.",
      },
      {
        question: "Who created the dichotomy of control?",
        answer:
          "The dichotomy of control is most closely associated with Epictetus, who placed it at the very beginning of the Enchiridion as the starting point for all Stoic practice. However, the concept runs through earlier Stoic thought as well. Marcus Aurelius applies it throughout the Meditations without always naming it explicitly \u2014 he constantly returns to the insight that he controls his own mind and nothing else. Epictetus gave the concept its clearest formulation, but it belongs to the Stoic tradition as a whole.",
      },
      {
        question: "Is amor fati a passive acceptance?",
        answer:
          "No. Amor fati is often misunderstood as passive resignation, but Marcus Aurelius demonstrates the opposite. He loved his fate while simultaneously leading armies, governing an empire, and making difficult decisions every day. Amor fati does not mean doing nothing; it means not wasting energy fighting reality. You accept what has already happened \u2014 because you cannot change it \u2014 and then you act on what is within your power. Epictetus teaches the same: accepting that the past is fixed frees you to focus entirely on the present, where your choices still matter.",
      },
      {
        question: "How do you practice amor fati?",
        answer:
          "Marcus Aurelius practiced amor fati by reframing every difficulty as useful. When he encountered ungrateful people, he used it to practice patience. When he faced loss, he used it to practice acceptance. His method was to find in every setback the opportunity to exercise a virtue. Epictetus teaches a complementary practice: when something bad happens, immediately ask what virtue the situation calls for. Over time, this reframing becomes natural, and you begin to see every event \u2014 welcome or unwelcome \u2014 as material for becoming the person you want to be. That shift from resistance to embrace is amor fati in practice.",
      },
    ],
    relatedSlugs: [
      "stoicism-and-anxiety",
      "stoicism-and-resilience",
      "how-to-practice-stoicism",
    ],
  },
  {
    slug: "the-four-stoic-virtues",
    title: "The Four Stoic Virtues",
    description:
      "Wisdom, Courage, Justice, and Temperance: the four cardinal virtues of Stoic philosophy. What Marcus Aurelius and Epictetus teach about living a virtuous life.",
    intro:
      "For the Stoics, virtue is the only true good. Everything else \u2014 health, wealth, reputation \u2014 is indifferent. The four cardinal virtues \u2014 Wisdom (sophia), Courage (andreia), Justice (dikaiosyne), and Temperance (sophrosyne) \u2014 define what it means to live well. Marcus Aurelius returns to them throughout the Meditations as the standard against which every action should be measured. Epictetus teaches that practicing these virtues is the whole point of philosophy. Below are the passages where they speak most directly about what virtue means and how to pursue it.",
    searchQueries: [
      "virtue wisdom courage justice temperance",
      "good character moral excellence",
      "doing what is right proper conduct",
      "self control moderation discipline",
      "living well according to nature",
    ],
    faqs: [
      {
        question: "What are the 4 Stoic virtues?",
        answer:
          "The four Stoic virtues are Wisdom, Courage, Justice, and Temperance. Wisdom is the ability to see clearly what is true and what matters. Courage is the willingness to do what is right despite difficulty or fear. Justice is treating others fairly and fulfilling your duties to the community. Temperance is self-control and moderation \u2014 not doing too much or too little. Marcus Aurelius calls these the pillars of a good life, and Epictetus teaches that practicing them is the entire purpose of philosophy.",
      },
      {
        question: "What are the 4 pillars of Marcus Aurelius?",
        answer:
          "Marcus Aurelius\u2019s four pillars are the same four cardinal virtues inherited from the Stoic tradition: Wisdom, Courage, Justice, and Temperance. Throughout the Meditations, he tests his decisions against these standards. When faced with a difficult person, he asks what virtue the situation requires. When tempted to avoid a hard task, he calls on courage. When frustrated, he practices temperance. For Marcus, these are not abstract ideals but daily tools \u2014 the operating system of a well-lived life.",
      },
      {
        question: "How can I practice Stoic virtues?",
        answer:
          "Start by using the virtues as a decision-making framework. When you face a challenge, ask: What does wisdom say about this situation? What would courage look like here? Am I treating others justly? Am I exercising self-control? Marcus Aurelius did this daily in his journal. Epictetus taught his students to examine every impression and action against the standard of virtue. You practice Stoic virtues not by thinking about them but by applying them \u2014 in conversations, at work, in relationships, and especially in moments of frustration or fear.",
      },
      {
        question: "What are the 4 Stoic vices?",
        answer:
          "The four Stoic vices are the opposites of the four virtues: Foolishness (the opposite of Wisdom), Cowardice (the opposite of Courage), Injustice (the opposite of Justice), and Intemperance or self-indulgence (the opposite of Temperance). Epictetus teaches that vice is not a separate force \u2014 it is simply the absence of virtue, caused by false judgments about what is good and what is bad. Marcus Aurelius warns himself throughout the Meditations against each of these failures, treating them as lapses of attention rather than permanent character flaws.",
      },
      {
        question: "What are the 4 passions of Stoicism?",
        answer:
          "The four Stoic passions (pathe) are irrational emotions that arise from false judgments: Fear (anticipation of something falsely judged as bad), Desire (longing for something falsely judged as good), Pain or Grief (reaction to something present falsely judged as bad), and Pleasure or Delight (reaction to something present falsely judged as good). Epictetus teaches that these passions are not forced upon us but follow from our beliefs. The virtues are the antidote: wisdom corrects the false judgments, and courage, justice, and temperance guide right action.",
      },
      {
        question: "Why is Justice the most important Stoic virtue?",
        answer:
          "Marcus Aurelius calls justice the most important virtue because humans are social beings. Wisdom, courage, and temperance perfect the individual, but justice governs how we treat others \u2014 and the Stoics believed we exist for each other. Epictetus teaches that fulfilling our roles (parent, citizen, friend, neighbor) is the practice of justice. Marcus Aurelius repeatedly reminds himself that working for the common good is the highest use of reason. Without justice, the other virtues serve only the self; with it, they serve everyone.",
      },
    ],
    relatedSlugs: [
      "how-to-practice-stoicism",
      "stoicism-and-control",
      "stoicism-and-resilience",
    ],
    pinnedEntries: [{ source: "meditations", book: 3, entry: "6" }],
  },
  {
    slug: "evolution-of-stoicism",
    title: "The Evolution of Stoicism",
    description:
      "From ancient Athens to the modern world: how Stoicism evolved over 2,300 years. Key figures, ideas, and the philosophy's enduring relevance.",
    intro:
      "Stoicism began on a painted porch in Athens around 300 BCE and never stopped evolving. Zeno, Cleanthes, and Chrysippus built the foundation. Seneca, Epictetus, and Marcus Aurelius gave it the form we know today — practical, personal, focused on what you can control. The philosophy survived the fall of Rome, influenced Christianity, shaped the Enlightenment, and now thrives in a digital age. The passages below trace this thread: ancient wisdom that speaks as clearly now as it did two millennia ago.",
    content: essays.evolutionOfStoicism,
    searchQueries: [
      "philosophy wisdom virtue reason nature",
      "history of thought ancient teachings endure",
      "living according to nature rational order",
      "what came before us predecessors legacy",
      "universal reason logos divine order",
    ],
    faqs: [
      {
        question: "What are the origins of Stoicism?",
        answer:
          "Stoicism was founded by Zeno of Citium in Athens around 300 BCE. He taught at the Stoa Poikile (Painted Porch), giving the school its name. Zeno drew on Cynic simplicity and Socratic ethics to build a philosophy centered on virtue, reason, and living in harmony with nature. His successors Cleanthes and Chrysippus systematized the doctrine across logic, physics, and ethics. By the time it reached Rome, Stoicism had become a practical philosophy of character — the form preserved in the writings of Seneca, Epictetus, and Marcus Aurelius.",
      },
      {
        question: "Who are the 4 Stoic philosophers?",
        answer:
          "The four most famous Stoic philosophers are Zeno of Citium (the founder), Seneca (Roman statesman and essayist), Epictetus (formerly enslaved teacher whose Discourses survive), and Marcus Aurelius (Roman Emperor who wrote the Meditations). Seneca, Epictetus, and Marcus Aurelius are called the Late Stoics or Roman Stoics. Their writings are the only complete Stoic texts that survive, and they form the core of Stoic philosophy as practiced today.",
      },
      {
        question: "Did Christianity take from Stoicism?",
        answer:
          "Early Christianity and Stoicism developed in the same Greco-Roman world and share significant overlap. Both emphasize virtue, self-examination, compassion, and the idea of a rational, providential cosmic order. The Stoic concept of Logos (universal reason) appears in the Gospel of John. Paul encountered Stoic philosophers in Athens. Concepts like natural law, conscience, and the equality of all people entered Christian theology partly through Stoic influence. The four cardinal virtues — wisdom, justice, courage, temperance — were adopted directly from the Stoic tradition.",
      },
      {
        question: "What is the dark side of Stoicism?",
        answer:
          "Critics argue that Stoicism can become emotional suppression if misunderstood. The philosophy does not teach you to feel nothing — Marcus Aurelius grieved, Epictetus acknowledged pain. What Stoicism teaches is that your judgments about events, not the events themselves, cause suffering. The real risk is using Stoicism as a mask — pretending to be unaffected rather than genuinely processing emotions. Both Marcus Aurelius and Epictetus warned against this: true Stoicism requires honesty with yourself, not performance for others.",
      },
      {
        question: "What is the biggest criticism of Stoicism?",
        answer:
          "The most common criticism is that Stoicism promotes passivity — that accepting what you cannot control means accepting injustice. But this misreads the Stoics. Marcus Aurelius governed an empire while practicing acceptance. Epictetus taught that your duties to others are firmly within your control. Stoicism distinguishes between emotional reaction (which clouds judgment) and purposeful action (which requires clarity). The philosophy calls you to act justly and courageously, not to disengage from the world.",
      },
      {
        question: "Is Stoicism relevant today?",
        answer:
          "Stoicism is more widely practiced today than at any point since ancient Rome. Its core ideas — focus on what you can control, build character over comfort, accept change as natural — speak directly to modern anxiety, information overload, and uncertainty. Cognitive behavioral therapy was explicitly modeled on Stoic principles. Millions read Marcus Aurelius and Epictetus for practical guidance on relationships, work, grief, and daily life. The philosophy endures because its subject is timeless: how to live well regardless of circumstances.",
      },
    ],
    relatedSlugs: [
      "main-goal-of-stoicism",
      "the-four-stoic-virtues",
      "how-to-practice-stoicism",
    ],
  },
  {
    slug: "embracing-the-stoic-mindset",
    title: "Embracing the Stoic Mindset",
    description:
      "What does it mean to think like a Stoic? Practical steps for cultivating resilience, emotional clarity, and inner strength from Marcus Aurelius and Epictetus.",
    intro:
      "A Stoic mindset is not about suppressing emotion or ignoring difficulty. It is about seeing clearly — distinguishing what depends on you from what does not, responding to impressions with reason rather than reflex, and treating every obstacle as material for growth. Marcus Aurelius trained this mindset daily in his journal. Epictetus taught it to students who came to him with real problems. Below are the passages that show what this way of thinking looks like in practice.",
    content: essays.embracingTheStoicMindset,
    searchQueries: [
      "discipline of perception judgment impression",
      "inner strength mental fortitude character",
      "obstacle opportunity growth training",
      "rational response not reaction emotion",
      "clear thinking reason over passion",
    ],
    faqs: [
      {
        question: "What is a Stoic mindset?",
        answer:
          "A Stoic mindset is a way of approaching life that prioritizes reason, self-awareness, and deliberate response over emotional reaction. It means recognizing that your power lies not in controlling events but in controlling how you interpret and respond to them. Marcus Aurelius practiced this by examining his thoughts each morning and evening. Epictetus taught that every impression should be tested before being accepted. The mindset is not passive — it is intensely active, requiring constant attention to your own thinking.",
      },
      {
        question: "How do you develop a Stoic mindset?",
        answer:
          "Start with the habit Marcus Aurelius modeled: daily self-examination. Each morning, anticipate difficulties and decide how you will respond virtuously. Each evening, review what went well and where you fell short. Practice Epictetus's discipline of impression — when something upsets you, pause and ask whether the event itself is harmful or whether your judgment about it is. Over time, this builds a habit of responding thoughtfully rather than reactively. The Stoic mindset is not achieved once; it is practiced daily.",
      },
      {
        question: "Is it unhealthy to be Stoic?",
        answer:
          "Genuine Stoicism is not unhealthy — it is a form of emotional intelligence. The philosophy does not ask you to deny feelings but to understand them. Marcus Aurelius felt grief, frustration, and fatigue; his Meditations are full of honest self-talk about these struggles. Epictetus acknowledged that first reactions (like flinching at a loud noise) are natural. What Stoicism warns against is letting those reactions dictate your actions. Problems arise only when people misuse Stoicism as emotional avoidance — which is the opposite of what the Stoics taught.",
      },
      {
        question: "What are the key characteristics of a Stoic mindset?",
        answer:
          "Four defining traits: emotional resilience (maintaining composure in difficulty), focus on virtue (prioritizing character over outcomes), control over perception (reframing obstacles as opportunities), and present-moment awareness (acting intentionally now rather than worrying about the future). Marcus Aurelius returns to each of these throughout the Meditations. Epictetus builds his entire teaching around the distinction between what is up to us and what is not — the foundation of all four traits.",
      },
      {
        question: "What do therapists think of Stoicism?",
        answer:
          "Many therapists view Stoicism favorably because cognitive behavioral therapy (CBT) — the most widely practiced evidence-based therapy — was directly inspired by Stoic philosophy. Albert Ellis and Aaron Beck, CBT's founders, credited Epictetus's insight that people are disturbed not by events but by their judgments about events. The Stoic practices of examining impressions, reframing adversity, and focusing on what you can control align closely with therapeutic techniques used for anxiety and depression.",
      },
      {
        question: "Can Stoicism help with anxiety?",
        answer:
          "Yes. Stoicism addresses anxiety at its root: the tendency to worry about things beyond your control. Epictetus taught that anxiety arises from wanting things to be other than they are. Marcus Aurelius wrote extensively about releasing attachment to outcomes and focusing on present action. Specific Stoic practices — negative visualization (imagining the worst to reduce its power), the dichotomy of control (sorting what depends on you from what does not), and morning preparation (anticipating difficulties) — are practical tools for managing anxiety.",
      },
    ],
    relatedSlugs: [
      "stoicism-and-anxiety",
      "stoicism-and-resilience",
      "how-to-practice-stoicism",
    ],
  },
  {
    slug: "main-goal-of-stoicism",
    title: "The Main Goal of Stoicism",
    description:
      "What is the purpose of Stoic philosophy? Virtue, eudaimonia, and living according to nature — the core aim explained through Marcus Aurelius and Epictetus.",
    intro:
      "The Stoics had one answer to every question about the good life: virtue. Not wealth, reputation, or pleasure — virtue alone. They called the result eudaimonia — not happiness in the modern sense, but flourishing: living in full alignment with your rational nature. Marcus Aurelius tested every decision against this standard. Epictetus taught that philosophy exists for one reason: to make you better. Below are the passages where they state this aim most clearly.",
    content: essays.mainGoalOfStoicism,
    searchQueries: [
      "virtue is the only good highest aim",
      "living well purpose meaning of life",
      "eudaimonia flourishing happiness contentment",
      "living according to nature rational soul",
      "philosophy as way of life practice",
    ],
    faqs: [
      {
        question: "What is the main purpose of Stoicism?",
        answer:
          "The main purpose of Stoicism is to achieve eudaimonia — a state of flourishing or well-being — through the practice of virtue. The Stoics believed that virtue (wisdom, courage, justice, and temperance) is the only true good, and that everything else — health, wealth, reputation — is indifferent. Marcus Aurelius wrote that the purpose of life is to act well in the role you have been given. Epictetus taught that philosophy is not about clever arguments but about living rightly. The goal is a life of moral excellence and inner peace.",
      },
      {
        question: "What is the golden rule of Stoicism?",
        answer:
          "The closest thing to a golden rule in Stoicism is the dichotomy of control: focus on what depends on you (your judgments, choices, and actions) and accept what does not (external events, other people's behavior, outcomes). Epictetus opens the Enchiridion with this principle. Marcus Aurelius returns to it throughout the Meditations. Everything else in Stoic practice follows from this distinction — if you master it, you have the foundation for every other Stoic teaching.",
      },
      {
        question: "What are the four main ideas of Stoicism?",
        answer:
          "The four main ideas correspond to the four cardinal virtues: Wisdom (seeing things as they truly are), Courage (doing what is right despite difficulty), Justice (treating others fairly and fulfilling your duties), and Temperance (exercising self-control and moderation). Together, these define what the Stoics meant by living according to nature — using your reason well in every situation. Marcus Aurelius called them the pillars of a good life. Epictetus taught that practicing them is the entire point of philosophy.",
      },
      {
        question: "What are the three main teachings of Stoicism?",
        answer:
          "Stoic philosophy rests on three disciplines, as described by Epictetus: the Discipline of Desire (wanting only what is in your control), the Discipline of Action (acting justly and for the common good), and the Discipline of Assent (examining your impressions before accepting them as true). Marcus Aurelius structured much of the Meditations around these three exercises. Together they cover the whole of life: what to want, how to act, and how to think.",
      },
      {
        question: "What is the core philosophy of Stoicism?",
        answer:
          "At its core, Stoicism teaches that virtue is sufficient for happiness and that external circumstances are morally indifferent. Your character — not your situation — determines the quality of your life. Epictetus, who was born into slavery and later freed, embodied this: he taught that even in chains, a person can be free through right judgment. Marcus Aurelius, who had every material advantage as emperor, practiced the same principle: none of it matters if you are not a good person.",
      },
      {
        question: "Who are the big 3 of Stoicism?",
        answer:
          "The big three of Stoicism are Seneca (c. 4 BCE – 65 CE), Epictetus (c. 50 – 135 CE), and Marcus Aurelius (121 – 180 CE). They are the Late Stoics or Roman Stoics, and their writings are the only complete Stoic works that survive. Seneca was a statesman and essayist. Epictetus was a formerly enslaved teacher whose lectures were recorded by his student Arrian. Marcus Aurelius was a Roman Emperor whose private journal became the Meditations. Each approached the same philosophy from a radically different life position.",
      },
    ],
    relatedSlugs: [
      "the-four-stoic-virtues",
      "evolution-of-stoicism",
      "how-to-practice-stoicism",
    ],
  },
  {
    slug: "stoicism-and-leadership",
    title: "Stoicism and Leadership",
    description:
      "What Marcus Aurelius and Epictetus teach about leading with virtue, reason, and composure. Stoic wisdom for leaders facing crisis and conflict.",
    intro:
      "Marcus Aurelius governed the Roman Empire during plague, war, and political crisis — and he did it while writing a philosophy journal. His Meditations is the most sustained example of Stoic leadership in practice: making decisions under pressure, treating people fairly, staying composed when everything falls apart. Epictetus taught that your duties to others are always within your control. Below are the passages where they speak most directly about responsibility, service, and leading by example.",
    content: essays.stoicismAndLeadership,
    searchQueries: [
      "leadership duty responsibility service others",
      "composure under pressure calm in crisis",
      "leading by example integrity character",
      "working for the common good community",
      "decision making reason over emotion",
    ],
    faqs: [
      {
        question: "Is Stoicism good for leadership?",
        answer:
          "Stoicism is one of the most effective leadership philosophies ever practiced. Marcus Aurelius led the Roman Empire using Stoic principles — focusing on what he could control, making decisions based on reason rather than anger or fear, and holding himself to a higher standard than those around him. Epictetus taught that a leader's first duty is self-mastery: you cannot govern others well if you cannot govern yourself. The Stoic emphasis on virtue, composure, and service to the common good translates directly to effective leadership.",
      },
      {
        question: "What does Marcus Aurelius say about leadership?",
        answer:
          "Marcus Aurelius never wrote a leadership manual, but the Meditations is full of leadership wisdom. He reminds himself to listen before judging, to assume good intent, to act for the common good rather than personal glory, and to lead by example rather than by force. He writes about the loneliness of command, the temptation of power, and the importance of remaining humble. His recurring theme: leadership is not a privilege but a duty — a role to be performed with justice, courage, and self-discipline.",
      },
      {
        question: "How can Stoicism help in a crisis?",
        answer:
          "Stoicism was built for crisis. Epictetus developed his philosophy while enslaved. Marcus Aurelius wrote the Meditations during a devastating plague and frontier wars. The core Stoic practice — separating what you control from what you do not — prevents panic and focuses energy on useful action. The Stoic virtues provide a decision-making framework when normal rules break down: act wisely, act justly, act courageously, and exercise restraint. Leaders who practice these principles remain effective when others are paralyzed.",
      },
      {
        question: "What are the 4 pillars of Stoicism?",
        answer:
          "The four pillars of Stoicism are the four cardinal virtues: Wisdom (sound judgment based on reality), Justice (fairness and duty to others), Courage (doing what is right despite difficulty or fear), and Temperance (self-control and moderation). Marcus Aurelius treated these as a daily checklist for decision-making. Epictetus taught that every situation calls for one or more of these virtues. For leaders, these pillars provide a moral framework that holds steady regardless of external pressure.",
      },
      {
        question: "Was Marcus Aurelius a good leader?",
        answer:
          "Marcus Aurelius is widely regarded as one of the best leaders in Roman history. He faced extraordinary challenges — the Antonine Plague killed millions, Germanic tribes invaded the empire, and a trusted general attempted a coup — yet he governed with restraint, justice, and personal integrity. Edward Gibbon called his reign part of the happiest period in human history. What makes Marcus remarkable is not that he avoided difficulty but that he met it with virtue, as documented in his own journal, the Meditations.",
      },
      {
        question: "What is Stoic leadership style?",
        answer:
          "Stoic leadership is leadership by character rather than charisma. It means making decisions based on principles rather than popularity, serving the common good rather than personal ambition, and maintaining composure under pressure. Marcus Aurelius modeled this: he listened to advisors, deliberated carefully, accepted criticism, and held himself to the same standards he expected of others. Epictetus taught that the best leader is one who has first mastered himself — who acts from wisdom and duty rather than ego or emotion.",
      },
    ],
    relatedSlugs: [
      "the-four-stoic-virtues",
      "stoicism-at-work",
      "stoicism-and-control",
    ],
  },
  {
    slug: "stoicism-and-gen-z",
    title: "Stoicism and Gen Z",
    description:
      "Why Gen Z is turning to ancient Stoic philosophy. How Marcus Aurelius and Epictetus speak to modern anxiety, uncertainty, and the search for meaning.",
    intro:
      "Stoicism is having a moment with Gen Z — not because it is trendy, but because it works. A generation facing economic uncertainty, information overload, and mental health challenges is finding practical answers in a 2,300-year-old philosophy. Marcus Aurelius on controlling your thoughts. Epictetus on not worrying about what you cannot change. These are not abstract ideas — they are tools. Below are the passages that resonate most directly with the challenges young people face today.",
    content: essays.stoicismAndGenZ,
    searchQueries: [
      "anxiety worry about things beyond control",
      "finding meaning purpose in uncertain times",
      "mental health resilience emotional strength",
      "discipline self improvement personal growth",
      "social media comparison letting go opinions",
    ],
    faqs: [
      {
        question: "What is Stoicism for Gen Z?",
        answer:
          "For Gen Z, Stoicism is a practical framework for handling anxiety, uncertainty, and the pressures of digital life. The core teaching — focus on what you can control and release what you cannot — speaks directly to a generation dealing with social media comparison, economic instability, and information overload. Marcus Aurelius's habit of daily self-examination maps naturally to journaling practices. Epictetus's teaching that your judgments, not events, cause suffering parallels the cognitive reframing techniques used in therapy.",
      },
      {
        question: "Why is Stoicism popular with young people?",
        answer:
          "Stoicism is popular with young people because it offers actionable guidance without requiring religious belief. As traditional religious observance has declined, many seek secular frameworks for navigating difficulty. Stoicism fills this gap: it teaches resilience, emotional regulation, and purpose through reason rather than faith. Marcus Aurelius and Epictetus wrote about the same struggles young people face today — anxiety about the future, frustration with others, the temptation to compare yourself to peers. The advice is concrete and immediately applicable.",
      },
      {
        question: "Is Stoicism just for men?",
        answer:
          "No. While Stoicism's modern social media presence skews male, the philosophy itself is universal. Marcus Aurelius wrote about human nature, not male nature. Epictetus taught students of all backgrounds. The Stoic virtues — wisdom, justice, courage, temperance — apply equally to everyone. The ancient Stoics explicitly taught that all humans share the same rational nature and moral capacity, regardless of gender, status, or origin. Musonius Rufus, a Roman Stoic, specifically argued that women should study philosophy on equal terms with men.",
      },
      {
        question: "How can I start practicing Stoicism?",
        answer:
          "Start with two practices from the ancient Stoics. First, Epictetus's dichotomy of control: each time something frustrates you, ask whether it is within your control. If yes, act. If no, let it go. Second, Marcus Aurelius's evening review: before bed, review your day — where did you act well? Where did you fall short? What will you do differently tomorrow? These two habits take minutes per day but build a foundation for everything else in Stoic philosophy. Read the Enchiridion (Epictetus's handbook) and Book 2 of the Meditations to deepen from there.",
      },
      {
        question: "Is Stoicism the same as not caring?",
        answer:
          "No — this is the most common misconception. Stoicism teaches that you should care deeply about the right things: your character, your duties, how you treat others. What it teaches you to release is attachment to things you cannot control — other people's opinions, the outcome of your efforts, events beyond your influence. Marcus Aurelius cared intensely about justice and the welfare of his people. Epictetus cared about his students' moral development. Stoicism is not indifference; it is directed attention.",
      },
      {
        question: "Can Stoicism help with social media anxiety?",
        answer:
          "Yes. Social media anxiety stems largely from comparison and the desire for external validation — exactly what Stoicism addresses. Marcus Aurelius repeatedly reminds himself that fame and others' opinions are worthless compared to the quality of your character. Epictetus teaches that if something is not in your control (likes, followers, others' perceptions), worrying about it is irrational. Stoic practice redirects attention from external metrics to internal standards: Am I acting with integrity? Am I using my time well? Am I treating people fairly?",
      },
    ],
    relatedSlugs: [
      "stoicism-and-anxiety",
      "embracing-the-stoic-mindset",
      "how-to-practice-stoicism",
    ],
  },
  {
    slug: "stoicism-and-impermanence",
    title: "Stoicism and Impermanence",
    description:
      "What Marcus Aurelius and Epictetus teach about change, loss, and the impermanence of all things. Finding peace by accepting what passes.",
    intro:
      "Nothing lasts. Marcus Aurelius returns to this theme more than any other in the Meditations — the endless cycle of change, the briefness of life, the vanishing of everything we hold onto. But this is not pessimism. For the Stoics, impermanence is a call to live fully now, to appreciate what you have while you have it, and to release your grip on what was never yours to keep. Epictetus teaches the same lesson from a different angle: everything is on loan. Below are the passages where they confront change most directly.",
    content: essays.stoicismAndImpermanence,
    searchQueries: [
      "impermanence change everything passes flux",
      "death mortality brevity of life",
      "letting go attachment loss acceptance",
      "time passing nothing lasts transient",
      "present moment appreciate what you have",
    ],
    faqs: [
      {
        question: "What does Marcus Aurelius say about change?",
        answer:
          "Marcus Aurelius writes about change constantly. He calls the universe a river of flux where nothing remains the same. He reminds himself that empires fall, names are forgotten, and everything solid dissolves. But his point is not despair — it is perspective. If everything changes, then clinging to any particular state is irrational. Instead, focus on acting well in this moment, with whatever you have. Change is not something that happens to you; it is the nature of reality itself, and resisting it causes suffering.",
      },
      {
        question: "What do the Stoics say about impermanence?",
        answer:
          "The Stoics teach that impermanence is built into the structure of the universe. Everything is material, and all material things transform. Marcus Aurelius uses vivid examples: the court of Augustus is dust, the victories of Alexander are forgotten, even the stars will burn out. Epictetus teaches a complementary lesson: everything you have — your body, your possessions, your relationships — is on loan from nature, and nature can reclaim it at any time. Understanding this is not morbid; it is the foundation of gratitude and freedom.",
      },
      {
        question: "How does accepting impermanence help?",
        answer:
          "Accepting impermanence reduces suffering in two ways. First, it prevents you from clinging to things that will inevitably change — health, youth, success, relationships in their current form. Second, it deepens your appreciation for what you have right now. Marcus Aurelius practiced negative visualization: imagining loss not to induce fear but to sharpen gratitude. When you truly understand that this moment will not come again, you pay better attention to it. Acceptance is not resignation — it is clear-eyed engagement with reality.",
      },
      {
        question: "What did Marcus Aurelius say about death?",
        answer:
          "Marcus Aurelius wrote about death frequently and without fear. He saw it as natural — the same process that transforms everything else in the universe. He reminds himself that Alexander the Great and his mule driver ended up in the same place. He writes that death is not an evil but a function of nature. His practical advice: do not waste time, do not postpone what matters, and do not let the fear of death prevent you from living well. Death makes life urgent; it does not make life meaningless.",
      },
      {
        question: "Is impermanence the same in Stoicism and Buddhism?",
        answer:
          "Stoicism and Buddhism share the recognition that all things change and that attachment to permanence causes suffering. Both teach practices for accepting this reality. However, the frameworks differ. Buddhism teaches that the self itself is impermanent (anatta) and seeks liberation from the cycle of rebirth. Stoicism maintains a strong sense of individual agency and moral duty — you accept change, but you also act virtuously within it. Marcus Aurelius embraces flux but still insists on doing your job well. Both paths lead to equanimity, but through different philosophical architectures.",
      },
      {
        question: "How to let go of attachment the Stoic way?",
        answer:
          "Epictetus offers a direct method: whenever you enjoy something, remind yourself of its nature. He gives the example of kissing your child goodnight and saying to yourself, 'Tomorrow you may not be here' — not to induce anxiety, but to cherish the moment fully and prepare yourself for loss. Marcus Aurelius practices this through reflection on time: everything you have already existed before you and will exist after you. The Stoic method is not to stop caring but to hold things with open hands — loving them without demanding they stay.",
      },
    ],
    relatedSlugs: [
      "stoicism-and-grief",
      "stoicism-and-control",
      "amor-fati",
    ],
  },
  {
    slug: "marcus-aurelius-on-virtue",
    title: "Marcus Aurelius on Virtue",
    description:
      "What Marcus Aurelius teaches about cultivating wisdom, justice, courage, and temperance. Character as the foundation of a good life.",
    intro:
      "For Marcus Aurelius, virtue is not an abstraction — it is the daily work of becoming a better person. Throughout the Meditations, he returns to the same question: Am I living up to the standard? Am I acting with wisdom, justice, courage, and self-control? He does not claim to have mastered these virtues. He practices them, falls short, and tries again. That honesty is what makes his writing so powerful. Below are the passages where he speaks most directly about what virtue means and why it matters more than anything else.",
    content: essays.marcusAureliusOnVirtue,
    searchQueries: [
      "virtue character moral excellence goodness",
      "wisdom doing what is right just action",
      "courage facing difficulty without complaint",
      "self discipline temperance moderation",
      "be a good person act with integrity",
    ],
    faqs: [
      {
        question: "What does Marcus Aurelius say about virtue?",
        answer:
          "Marcus Aurelius says that virtue is the only thing worth pursuing. Everything else — health, wealth, fame, pleasure — is indifferent compared to the quality of your character. He writes that a good person is one who acts with justice, wisdom, courage, and self-control in every situation, regardless of what it costs them. In Meditations 3.6, he challenges himself: if you ever find anything better than justice, honesty, self-control, and courage, embrace it — but he is confident nothing better exists.",
      },
      {
        question: "What are the 4 virtues of Marcus Aurelius?",
        answer:
          "Marcus Aurelius inherited the four cardinal virtues from the Stoic tradition: Wisdom (the ability to see clearly and judge well), Justice (treating others fairly and fulfilling your duties), Courage (doing what is right despite difficulty, pain, or fear), and Temperance (self-control and moderation in all things). He did not treat these as separate categories but as aspects of one unified excellence of character. Every situation calls for some combination of all four.",
      },
      {
        question: "How did Marcus Aurelius practice virtue?",
        answer:
          "Marcus Aurelius practiced virtue through daily self-examination. The Meditations is his practice journal — written not for publication but for himself, as a tool for becoming better. He would remind himself of principles each morning, test his actions against them during the day, and review his conduct each evening. He wrote about specific challenges: controlling his temper, treating difficult people with fairness, not being corrupted by imperial power, staying focused on duty rather than comfort.",
      },
      {
        question: "What is the paradox of virtue?",
        answer:
          "The Stoic paradox of virtue is that virtue is both necessary and sufficient for happiness. This means a wise and just person is happy even in poverty or prison, while a wealthy tyrant is miserable despite having everything. Marcus Aurelius tested this idea against his own experience as emperor: having unlimited power and wealth did not make him happy. What gave his life meaning was acting rightly, serving others, and maintaining his integrity. Epictetus, who lived in poverty, taught the same thing from the opposite direction.",
      },
      {
        question: "What is virtue according to Epictetus?",
        answer:
          "Epictetus defines virtue as the correct use of impressions — making right judgments and acting on them. For Epictetus, virtue is not something you have but something you do: it is the continuous practice of using your reason well. He teaches that every moment presents a choice: respond with virtue or with vice. Virtue means examining your impressions, fulfilling your roles (as parent, citizen, friend), and treating every person as a fellow rational being deserving of respect.",
      },
      {
        question: "Why is virtue more important than success?",
        answer:
          "Marcus Aurelius argues that success without virtue is worthless because external achievements can be taken away at any moment, while character remains. He points to history: powerful people are forgotten, empires crumble, fortunes vanish. What endures is the example of a person who lived well — justly, wisely, courageously. Epictetus goes further: pursuing external success at the expense of virtue is the fundamental human error. You gain the world but lose yourself. The Stoics teach that virtue is success — everything else is a footnote.",
      },
    ],
    relatedSlugs: [
      "the-four-stoic-virtues",
      "main-goal-of-stoicism",
      "how-to-practice-stoicism",
    ],
    pinnedEntries: [{ source: "meditations", book: 3, entry: "6" }],
  },
  {
    slug: "stoicism-and-community",
    title: "Stoicism and Community",
    description:
      "What Marcus Aurelius and Epictetus teach about our duty to others, social nature, and the interconnectedness of all people.",
    intro:
      "Stoicism is often misunderstood as a solitary philosophy — the lone individual toughening themselves against the world. But the Stoics taught the opposite. Marcus Aurelius writes repeatedly that human beings are made for cooperation, that harming others is harming yourself, and that your primary duty is to the community. Epictetus grounds his ethics in relationships: your roles as parent, citizen, friend, and neighbor define your obligations. Below are the passages where they speak most clearly about what we owe each other.",
    content: essays.stoicismAndCommunity,
    searchQueries: [
      "social nature cooperation community duty",
      "we exist for each other mutual aid",
      "roles obligations parent citizen friend",
      "common good serving others justice",
      "interconnected all things work together",
    ],
    faqs: [
      {
        question: "What do Stoics say about community?",
        answer:
          "The Stoics teach that human beings are fundamentally social creatures — made for cooperation, not isolation. Marcus Aurelius writes that working against each other is as unnatural as a foot refusing to walk. We share the same rational nature, the same capacity for virtue, and the same community. Epictetus teaches that your identity is defined by your relationships and roles. Stoicism is not about withdrawing from the world but about engaging with it justly and compassionately.",
      },
      {
        question: "Did Marcus Aurelius believe in interconnectedness?",
        answer:
          "Yes. Marcus Aurelius saw the universe as a single living organism in which every part affects every other part. He writes that all things are interwoven and that the bond is sacred. Nothing exists in isolation — your actions ripple outward, affecting others in ways you may never see. This interconnectedness grounds his ethical teaching: because we are all connected, harming another person is harming yourself. Acting for the common good is not selflessness; it is rational self-interest properly understood.",
      },
      {
        question: "What does Stoicism say about helping others?",
        answer:
          "Stoicism teaches that helping others is one of your primary duties as a rational being. Marcus Aurelius writes that the purpose of human life is to work for the common good — not reluctantly, but gladly. Epictetus teaches that fulfilling your roles (as parent, friend, colleague, citizen) with excellence is the practice of justice. The Stoics do not teach charity as sacrifice; they teach service as the natural expression of understanding your place in the human community.",
      },
      {
        question: "Is Stoicism selfish or individualistic?",
        answer:
          "This is a common misconception. While Stoicism emphasizes personal responsibility for your own judgments and actions, it explicitly teaches that you exist for others. Marcus Aurelius writes that a person who cuts themselves off from the community is like a branch cut from a tree. Epictetus warns against living only for yourself. The Stoic ideal is not the self-sufficient loner but the engaged citizen who contributes to the common good while maintaining inner freedom. Justice — treating others well — is one of the four cardinal virtues, equal in importance to wisdom.",
      },
      {
        question: "How does Stoicism view difficult people?",
        answer:
          "Marcus Aurelius wrote extensively about dealing with difficult people — he encountered them daily as emperor. His approach: remember that the person acts from ignorance, not malice. They have the same rational nature you do but are using it poorly. Your job is not to fix them but to respond with virtue: patience, fairness, and compassion. Epictetus teaches that another person's behavior is not in your control; only your response is. Getting angry at someone for being difficult is like getting angry at the weather — it accomplishes nothing and harms you.",
      },
      {
        question: "What is Stoic cosmopolitanism?",
        answer:
          "Stoic cosmopolitanism is the idea that all human beings belong to one community — the community of rational beings. Marcus Aurelius calls himself a citizen of the world, not just of Rome. National, ethnic, and social boundaries are accidents of birth; what matters is that every person shares the same rational nature and moral worth. This teaching was radical in the ancient world and profoundly influenced later concepts of universal human rights, natural law, and the equality of all people before the law.",
      },
    ],
    relatedSlugs: [
      "stoicism-and-relationships",
      "the-four-stoic-virtues",
      "stoicism-and-leadership",
    ],
  },
  {
    slug: "stoicism-and-the-mind",
    title: "Stoicism and the Mind",
    description:
      "What Marcus Aurelius and Epictetus teach about the power of thought, perception, and inner freedom. Mastering your mind through Stoic philosophy.",
    intro:
      "Everything begins in the mind. Marcus Aurelius writes that your life is what your thoughts make it. Epictetus teaches that it is not events but your judgments about events that cause suffering. This is not positive thinking — it is radical honesty about where your power lies. You cannot control what happens to you, but you can control how you interpret it, and that interpretation shapes everything. Below are the passages where they speak most directly about the mind's power and how to use it well.",
    content: essays.stoicismAndTheMind,
    searchQueries: [
      "power of mind thoughts perception judgment",
      "inner freedom mental strength sovereignty",
      "impressions opinions judgments about events",
      "choose your response not reaction",
      "soul mind rational faculty ruling reason",
    ],
    faqs: [
      {
        question: "What did Marcus Aurelius say about the mind?",
        answer:
          "Marcus Aurelius wrote that you have power over your mind — not outside events — and that realizing this is the source of strength. He repeatedly reminds himself that the quality of his life depends on the quality of his thoughts. He writes that the soul is dyed the color of its thoughts, and that if you are distressed by anything external, the pain is not due to the thing itself but to your estimate of it — and this you have the power to revoke at any moment.",
      },
      {
        question: "What is the Stoic philosophy of the mind?",
        answer:
          "The Stoic philosophy of the mind holds that your ruling faculty (hegemonikon) — your capacity for reason and judgment — is the one thing truly in your power. External events provide raw impressions; your mind decides what to make of them. Epictetus teaches that between stimulus and response there is a space, and in that space lies your freedom. Marcus Aurelius practices this by examining his impressions before reacting — asking whether what seems harmful truly is, or whether his judgment is creating unnecessary suffering.",
      },
      {
        question: "How to control your mind with Stoicism?",
        answer:
          "The Stoics do not teach mind control in the sense of suppressing thoughts. They teach the discipline of assent — examining each impression before accepting it as true. When something disturbs you, pause and ask: Is this actually harmful, or am I adding a judgment that makes it seem so? Marcus Aurelius practiced this daily in his journal. Epictetus taught students to question every impression: Does this depend on me? Is my response proportionate? Over time, this builds a habit of responding from reason rather than reflex.",
      },
      {
        question: "What do the Stoics say about overthinking?",
        answer:
          "Marcus Aurelius warned himself repeatedly against the trap of overthinking. He writes that you should stop talking about what a good person should be and just be one. He counsels action over deliberation: do what needs to be done, now, without excessive analysis. Epictetus teaches the same principle — philosophy is not about clever arguments but about practice. The Stoic antidote to overthinking is present-moment action: focus on the task in front of you, do it well, and move to the next one.",
      },
      {
        question: "Did Marcus Aurelius say you have power over your mind?",
        answer:
          "Yes. This is one of the most frequently quoted Stoic ideas, and it runs throughout the Meditations. Marcus Aurelius writes that the universe is change and that life is opinion — meaning your experience of life is shaped by how you interpret it. He tells himself that he can choose to remove his judgment about an apparent harm, and the harm disappears. This is not denial; it is the recognition that many of the things that distress you are distressing only because of the story you tell about them.",
      },
      {
        question: "How can Stoic philosophy improve mental health?",
        answer:
          "Stoic philosophy improves mental health by teaching you to identify and question the thoughts that cause unnecessary suffering. This is the same principle underlying cognitive behavioral therapy, which was directly inspired by Epictetus. The practice of examining impressions, distinguishing what you control from what you do not, and focusing on present action rather than future worry provides concrete tools for managing anxiety, rumination, and emotional reactivity. Marcus Aurelius used these tools daily — the Meditations is essentially a mental health practice journal.",
      },
    ],
    relatedSlugs: [
      "stoicism-and-anxiety",
      "stoicism-and-control",
      "embracing-the-stoic-mindset",
    ],
  },
  {
    slug: "amor-fati",
    title: "Amor Fati: Loving Your Fate",
    description:
      "What the Stoics teach about embracing fate, accepting what happens, and finding meaning in everything life brings. Amor fati explained through Marcus Aurelius and Epictetus.",
    intro:
      "Amor fati — love of fate — is the Stoic practice of not merely accepting what happens but embracing it. Marcus Aurelius writes about welcoming each event as something willed by the universe, working with it rather than against it. Epictetus teaches that wanting things to happen as they do, rather than as you wish, is the path to freedom. This is not passive resignation — it is the active choice to find meaning and opportunity in whatever life brings. Below are the passages where they practice this most directly.",
    content: essays.amorFati,
    searchQueries: [
      "amor fati love fate accept what happens",
      "embrace destiny welcome whatever comes",
      "acceptance surrender will of nature providence",
      "not what happens but how you respond",
      "cooperate with the inevitable work with fate",
    ],
    faqs: [
      {
        question: "What does amor fati mean in Stoicism?",
        answer:
          "Amor fati means 'love of fate' — the practice of not just accepting but actively embracing everything that happens to you. Marcus Aurelius expresses this throughout the Meditations: he writes about accepting the things to which fate binds you and loving the people with whom fate brings you together. Epictetus teaches a related principle: do not seek for things to happen as you wish; rather, wish for them to happen as they do, and you will go on well. Both teach that fighting reality is the source of suffering, while working with it is the source of peace.",
      },
      {
        question: "Did Marcus Aurelius say amor fati?",
        answer:
          "Marcus Aurelius did not use the Latin phrase 'amor fati' — that formulation comes from Nietzsche in the 19th century. But the concept is central to the Meditations. Marcus writes about accepting the dispensation of Providence, welcoming what happens as what was meant for you, and understanding that everything in the universe unfolds according to nature. His attitude toward fate is not passive — he actively chooses to see each event as material for virtue, an opportunity to practice wisdom, courage, and justice.",
      },
      {
        question: "How to apply amor fati in daily life?",
        answer:
          "Start with small frustrations. When plans change unexpectedly, instead of resisting, ask: How can I work with this? What does this situation require of me? Marcus Aurelius practiced this with everything from annoying courtiers to frontier wars. Epictetus taught students to mentally rehearse difficulties each morning: 'Today I will encounter rudeness, ingratitude, and obstruction — and I will meet them with equanimity.' The practice is not pretending everything is fine; it is choosing to engage constructively with reality as it actually is.",
      },
      {
        question: "What do Stoics believe about fate?",
        answer:
          "The Stoics believed that the universe operates according to a rational order (Logos) and that events unfold through a chain of causes they called fate or Providence. Marcus Aurelius sees this order as benevolent — not designed for any individual's comfort, but serving the good of the whole. Epictetus teaches that your fate — what happens to you — is not in your control, but your response to it is entirely yours. The Stoic relationship with fate is neither blind submission nor rebellion; it is intelligent cooperation.",
      },
      {
        question: "Is amor fati the same as giving up?",
        answer:
          "No. Amor fati is the opposite of giving up. It means engaging fully with reality rather than wasting energy wishing things were different. Marcus Aurelius governed an empire while practicing acceptance — he accepted the plague but fought to save lives; he accepted the war but led his troops with courage. Epictetus taught that acceptance of what you cannot control frees you to act decisively on what you can. Amor fati gives you more energy for purposeful action, not less, because you are no longer wasting it on resistance.",
      },
      {
        question: "What is the difference between amor fati and resignation?",
        answer:
          "Resignation says 'There is nothing I can do.' Amor fati says 'This is what happened — now what is the best I can do with it?' Marcus Aurelius draws this distinction clearly: he accepts that people will be ungrateful and dishonest, but he does not stop serving them. He accepts that he will die, but he does not stop living with purpose. Epictetus teaches that resignation is a failure of will, while acceptance is an act of wisdom. The Stoic embraces fate not because they are powerless but because fighting reality is irrational.",
      },
    ],
    relatedSlugs: [
      "stoicism-and-control",
      "stoicism-and-impermanence",
      "stoicism-and-resilience",
    ],
  },
  {
    slug: "best-stoicism-books",
    title: "The Best Books on Stoicism",
    description:
      "Essential Stoic reading: ancient primary sources and the best modern introductions. Where to start with Marcus Aurelius, Epictetus, and Seneca.",
    intro:
      "The best way to learn Stoicism is to read the Stoics themselves. Marcus Aurelius's Meditations, Epictetus's Discourses and Enchiridion, and Seneca's Letters are the foundational texts — and they are surprisingly readable. Modern introductions can help, but nothing replaces the originals. Below are passages from the primary sources to give you a taste of what awaits. If these resonate, pick up the full texts and start reading.",
    content: essays.bestStoicismBooks,
    searchQueries: [
      "meditations marcus aurelius wisdom teachings",
      "discourses enchiridion epictetus practical philosophy",
      "letters seneca moral guidance counsel",
      "stoic philosophy reading study learning",
      "ancient wisdom books that change your life",
    ],
    faqs: [
      {
        question: "What is the best book to read for Stoicism?",
        answer:
          "Start with the Meditations by Marcus Aurelius (Gregory Hays translation). It is the most accessible Stoic text — short, personal, and immediately practical. Marcus writes to himself about the challenges he faces daily: difficult people, the temptation of power, the fear of death, the struggle to be good. There is no jargon, no argument to follow. Each entry is a standalone reflection you can read in under a minute. If you read one Stoic book, make it this one.",
      },
      {
        question: "Which Stoic should I read first?",
        answer:
          "Marcus Aurelius is the best starting point because the Meditations was written for personal use, not as a teaching text. It reads like a journal and requires no background knowledge. After Marcus, read Epictetus — the Enchiridion first (a short handbook of Stoic principles), then the Discourses (classroom lectures recorded by his student Arrian). Epictetus is more systematic than Marcus and gives you the philosophical framework behind the practices. Seneca's Letters from a Stoic comes third — elegant, literary, and full of practical wisdom.",
      },
      {
        question: "What are the 3 essential Stoic texts?",
        answer:
          "The three essential Stoic texts are the Meditations by Marcus Aurelius (personal reflections of a Roman Emperor), the Discourses and Enchiridion by Epictetus (teaching lectures and a practical handbook), and the Letters from a Stoic by Seneca (moral letters to a friend on how to live well). These are the only complete surviving works of the ancient Stoics. Everything else we know about Stoic philosophy comes from fragments, summaries, and references by other writers. These three texts are where Stoic practice lives.",
      },
      {
        question: "What are the best modern books on Stoicism?",
        answer:
          "For beginners, A Guide to the Good Life by William B. Irvine is the most accessible modern introduction — it explains Stoic strategies for daily life without academic jargon. How to Be a Stoic by Massimo Pigliucci uses an imagined dialogue with Epictetus to explore Stoic ideas. For daily practice, The Daily Stoic by Ryan Holiday offers 366 short reflections with commentary. For deeper study, Stoicism and the Art of Happiness by Donald Robertson connects Stoic practice to modern psychology. All four assume no prior knowledge.",
      },
      {
        question: "What books do the Daily Stoic recommend?",
        answer:
          "The Daily Stoic framework centers on the three primary sources: Meditations (Marcus Aurelius), Discourses and Enchiridion (Epictetus), and Letters from a Stoic (Seneca). Ryan Holiday's own books — The Obstacle Is the Way, Ego Is the Enemy, and Stillness Is the Key — apply Stoic principles to modern challenges through historical examples. For a structured weekly practice, A Handbook for New Stoics by Pigliucci and Lopez provides 52 exercises based directly on the ancient texts.",
      },
      {
        question: "Is Meditations by Marcus Aurelius hard to read?",
        answer:
          "No — in the right translation. The Gregory Hays translation (Modern Library, 2002) is widely regarded as the most readable English version. It uses contemporary language and avoids archaic phrasing. The Meditations was never meant to be difficult; Marcus wrote it as private notes to himself, not as a philosophical treatise for scholars. Each entry is brief — some are a single sentence. The challenge is not comprehension but application: the ideas are simple to understand and hard to practice.",
      },
    ],
    relatedSlugs: [
      "how-to-practice-stoicism",
      "main-goal-of-stoicism",
      "evolution-of-stoicism",
    ],
  },
];

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCitation(entry: {
  source: string;
  book: number;
  entry: string;
}): string {
  const labels: Record<string, string> = {
    meditations: "Meditations",
    "seneca-tranquillity": "On the Tranquillity of Mind",
    "seneca-shortness": "On the Shortness of Life",
    discourses: "Discourses",
    enchiridion: "Enchiridion",
    fragments: "Fragments",
  };
  const label = labels[entry.source] || "Meditations";
  return `${label} ${entry.book}.${entry.entry}`;
}

// ---------------------------------------------------------------------------
// Shared CSS (extracted from index.ts, same design language)
// ---------------------------------------------------------------------------

const sharedCss = `
    :root {
      --sans-serif: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", "Liberation Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
      --serif: ui-serif, -apple-system-ui-serif, Palatino, Georgia, Cambria, "Times New Roman", Times, serif;

      --eigengrau: #16161d;
      --blue-dark: #06c;
      --blue-light: #2997ff;

      --bg: #f5f5f7;
      --text: #16161d;
      --text-muted: #6e6e73;
      --text-faint: #86868b;
      --accent: #06c;
      --border: #d2d2d7;
      --border-light: #e5e5ea;
      --surface: #ffffff;
      --surface-alt: #f0f0f5;
      --surface-alt-border: #d2d2d7;
      --btn-hover: #e8e8ed;
      --focus-ring: rgba(0, 102, 204, 0.15);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #16161d;
        --text: #f0f0f5;
        --text-muted: #98989d;
        --text-faint: #636366;
        --accent: #2997ff;
        --border: #38383d;
        --border-light: #2c2c31;
        --surface: #1c1c21;
        --surface-alt: #222228;
        --surface-alt-border: #38383d;
        --btn-hover: #2c2c31;
        --focus-ring: rgba(41, 151, 255, 0.2);
      }
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--sans-serif);
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1rem;
    }

    .container {
      max-width: 640px;
      width: 100%;
    }

    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }

    .breadcrumb {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 1.5rem;
    }
    .breadcrumb a { color: var(--text-muted); }
    .breadcrumb a:hover { color: var(--accent); }

    h1 {
      font-size: 1.75rem;
      font-weight: 600;
      margin-bottom: 1rem;
      letter-spacing: 0.02em;
    }

    h2 {
      font-size: 1.1rem;
      font-weight: 600;
      margin-top: 2.5rem;
      margin-bottom: 1rem;
      letter-spacing: 0.02em;
      color: var(--text);
    }

    .note-intro {
      font-family: var(--serif);
      font-size: 1.05rem;
      line-height: 1.7;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }

    .note-essay {
      margin-top: 2rem;
      margin-bottom: 1rem;
    }

    .note-essay p {
      font-family: var(--serif);
      font-size: 1.05rem;
      line-height: 1.7;
      color: var(--text-muted);
      margin-bottom: 1rem;
    }

    .note-essay h2 {
      font-size: 1.1rem;
      font-weight: 600;
      margin-top: 2rem;
      margin-bottom: 0.75rem;
      color: var(--text);
    }

    .note-essay h3 {
      font-size: 1rem;
      font-weight: 600;
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
      color: var(--text);
    }

    .note-essay h4 {
      font-size: 0.9rem;
      font-weight: 600;
      margin-top: 1.25rem;
      margin-bottom: 0.5rem;
      color: var(--text-muted);
    }

    .note-essay ul, .note-essay ol {
      margin-left: 1.5rem;
      margin-bottom: 1rem;
      font-family: var(--serif);
      font-size: 1.05rem;
      line-height: 1.7;
      color: var(--text-muted);
    }

    .note-essay li {
      margin-bottom: 0.5rem;
    }

    .note-essay blockquote {
      border-left: 3px solid var(--accent);
      padding: 0.75rem 1.25rem;
      margin: 1.25rem 0;
      font-family: var(--serif);
      font-size: 1.05rem;
      font-style: italic;
      line-height: 1.7;
      color: var(--text-muted);
      background: var(--surface);
      border-radius: 0 4px 4px 0;
    }

    .note-essay table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .note-essay th, .note-essay td {
      padding: 0.75rem;
      border: 1px solid var(--border-light);
      text-align: left;
      vertical-align: top;
    }

    .note-essay th {
      background: var(--surface);
      font-weight: 600;
      color: var(--text);
    }

    .note-essay td {
      color: var(--text-muted);
    }

    .note-essay a {
      color: var(--accent);
      text-decoration: none;
    }

    .note-essay a:hover {
      text-decoration: underline;
    }

    .note-essay strong, .note-essay b {
      font-weight: 600;
      color: var(--text);
    }

    .entry {
      margin-bottom: 1.5rem;
      padding: 1.5rem;
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .entry-text {
      font-family: var(--serif);
      font-size: 1.05rem;
      line-height: 1.7;
      white-space: pre-wrap;
    }

    .entry-citation {
      margin-top: 1rem;
      font-size: 0.85rem;
      color: var(--accent);
      font-style: italic;
    }

    details {
      margin-bottom: 0.75rem;
      border: 1px solid var(--border-light);
      border-radius: 6px;
      background: var(--surface);
    }

    summary {
      padding: 1rem 1.25rem;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.95rem;
      line-height: 1.4;
      list-style: none;
    }

    summary::-webkit-details-marker { display: none; }

    summary::before {
      content: "+";
      display: inline-block;
      width: 1.25rem;
      font-weight: 400;
      color: var(--text-muted);
    }

    details[open] summary::before {
      content: "\\2212";
    }

    details[open] summary {
      border-bottom: 1px solid var(--border-light);
    }

    .faq-answer {
      padding: 1rem 1.25rem 1.25rem 2.5rem;
      font-family: var(--serif);
      font-size: 0.95rem;
      line-height: 1.7;
      color: var(--text-muted);
    }

    .explore-further {
      margin-top: 2.5rem;
      margin-bottom: 1rem;
    }

    .related-links {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }

    .related-link {
      font-size: 0.9rem;
    }

    .note-card {
      display: block;
      padding: 1.25rem 1.5rem;
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: 6px;
      margin-bottom: 1rem;
      text-decoration: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .note-card:hover {
      border-color: var(--accent);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      text-decoration: none;
    }

    .note-card-title {
      font-weight: 600;
      font-size: 1rem;
      color: var(--text);
      margin-bottom: 0.3rem;
    }

    .note-card-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .fade-in {
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    footer {
      margin-top: 3rem;
      text-align: center;
      font-family: var(--sans-serif);
      font-size: 0.75rem;
      color: var(--text-faint);
    }

    footer a { color: var(--accent); text-decoration: none; }
    footer a:hover { text-decoration: underline; }
`;

// ---------------------------------------------------------------------------
// Page renderers
// ---------------------------------------------------------------------------

function renderNotesIndex(): string {
  const noteCards = NOTES.map(
    (n) => `
      <a class="note-card" href="/notes/${n.slug}">
        <div class="note-card-title">${escapeHtml(n.title)}</div>
        <div class="note-card-desc">${escapeHtml(n.description)}</div>
      </a>`,
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Notes \u2014 Stoic Sage</title>
  <meta name="description" content="Thematic notes on Stoic philosophy. Explore what Marcus Aurelius and Epictetus teach about anxiety, grief, resilience, relationships, and more.">
  <meta property="og:title" content="Notes \u2014 Stoic Sage">
  <meta property="og:description" content="Thematic notes on Stoic philosophy. Explore what Marcus Aurelius and Epictetus teach about anxiety, grief, resilience, relationships, and more.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://stoicsage.ai/notes">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Notes \u2014 Stoic Sage">
  <meta name="twitter:description" content="Thematic notes on Stoic philosophy from Marcus Aurelius and Epictetus.">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F3DB}\uFE0F</text></svg>">
  <link rel="canonical" href="https://stoicsage.ai/notes">
  <style>${sharedCss}</style>
</head>
<body>
  <div class="container fade-in">
    <nav class="breadcrumb">
      <a href="/">Stoic Sage</a> \u203A Notes
    </nav>

    <h1>Notes</h1>
    <p class="note-intro">Thematic explorations of Stoic philosophy, drawn from the Meditations by Marcus Aurelius, and the Discourses, Enchiridion, and Fragments by Epictetus.</p>

    <div style="margin-top: 2rem;">
      ${noteCards}
    </div>

    <footer>
      <a href="/">Stoic Sage</a> \u00B7
      <a href="https://vreeman.com/meditations">Meditations</a> (Gregory Hays) \u00B7 <a href="https://vreeman.com/seneca/on-the-tranquillity-of-mind">On the Tranquillity of Mind</a> \u00B7 <a href="https://vreeman.com/seneca/on-the-shortness-of-life">On the Shortness of Life</a> (Seneca) \u00B7 <a href="https://vreeman.com/discourses/">Discourses</a> \u00B7 <a href="https://vreeman.com/discourses/enchiridion">Enchiridion</a> \u00B7 <a href="https://vreeman.com/discourses/fragments">Fragments</a> (Robert Dobbin)
    </footer>
  </div>
</body>
</html>`;
}

function renderNotePage(
  note: Note,
  entries: { source: string; book: number; entry: string; text: string }[],
): string {
  const entriesHtml = entries
    .map(
      (e) => `
      <div class="entry">
        <div class="entry-text">${escapeHtml(e.text)}</div>
        <div class="entry-citation">${formatCitation(e)}</div>
      </div>`,
    )
    .join("");

  const faqsHtml =
    note.faqs.length > 0
      ? note.faqs
          .map(
            (f) => `
      <details>
        <summary>${escapeHtml(f.question)}</summary>
        <div class="faq-answer">${escapeHtml(f.answer)}</div>
      </details>`,
          )
          .join("")
      : '<p style="color: var(--text-muted); font-style: italic; font-size: 0.9rem;">Answers coming soon.</p>';

  const relatedNotes = note.relatedSlugs
    .map((slug) => NOTES.find((n) => n.slug === slug))
    .filter(Boolean) as Note[];

  const relatedHtml =
    relatedNotes.length > 0
      ? relatedNotes
          .map(
            (r) =>
              `<a class="related-link" href="/notes/${r.slug}">${escapeHtml(r.title)}</a>`,
          )
          .join("")
      : "";

  // FAQ structured data (JSON-LD) for SEO
  const faqSchema =
    note.faqs.length > 0
      ? `<script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: note.faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: f.answer,
            },
          })),
        })}</script>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(note.title)} \u2014 Stoic Sage</title>
  <meta name="description" content="${escapeHtml(note.description)}">
  <meta property="og:title" content="${escapeHtml(note.title)} \u2014 Stoic Sage">
  <meta property="og:description" content="${escapeHtml(note.description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://stoicsage.ai/notes/${note.slug}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(note.title)} \u2014 Stoic Sage">
  <meta name="twitter:description" content="${escapeHtml(note.description)}">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>\u{1F3DB}\uFE0F</text></svg>">
  <link rel="canonical" href="https://stoicsage.ai/notes/${note.slug}">
  ${faqSchema}
  <style>${sharedCss}</style>
</head>
<body>
  <div class="container fade-in">
    <nav class="breadcrumb">
      <a href="/">Stoic Sage</a> \u203A <a href="/notes">Notes</a> \u203A ${escapeHtml(note.title)}
    </nav>

    <h1>${escapeHtml(note.title)}</h1>
    <p class="note-intro">${escapeHtml(note.intro)}</p>

    ${note.content ? `<div class="note-essay">${note.content}</div>` : ""}

    <h2>What the Stoics Said</h2>
    ${entriesHtml || '<p style="color: var(--text-muted); font-style: italic;">Loading entries\u2026</p>'}

    <h2>Frequently Asked Questions</h2>
    ${faqsHtml}

    <div class="explore-further">
      <h2>Explore Further</h2>
      <a href="/?q=${encodeURIComponent(note.title.replace("Control and Acceptance", "control acceptance"))}" style="font-size: 0.9rem;">Search for \u201c${escapeHtml(note.title)}\u201d on Stoic Sage \u2192</a>
      ${relatedHtml ? `<div class="related-links" style="margin-top: 1rem;">${relatedHtml}</div>` : ""}
    </div>

    <footer>
      <a href="/">Stoic Sage</a> \u00B7 <a href="/notes">Notes</a> \u00B7
      <a href="https://vreeman.com/meditations">Meditations</a> (Gregory Hays) \u00B7 <a href="https://vreeman.com/seneca/on-the-tranquillity-of-mind">On the Tranquillity of Mind</a> \u00B7 <a href="https://vreeman.com/seneca/on-the-shortness-of-life">On the Shortness of Life</a> (Seneca) \u00B7 <a href="https://vreeman.com/discourses/">Discourses</a> \u00B7 <a href="https://vreeman.com/discourses/enchiridion">Enchiridion</a> \u00B7 <a href="https://vreeman.com/discourses/fragments">Fragments</a> (Robert Dobbin)
    </footer>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Semantic search helper
// ---------------------------------------------------------------------------

async function searchEntries(
  env: Bindings,
  queries: string[],
  maxResults = 8,
): Promise<{ source: string; book: number; entry: string; text: string }[]> {
  const uniqueQueries = [...new Set(queries.map((q) => q.trim()).filter(Boolean))].slice(0, 6);
  if (uniqueQueries.length === 0) return [];

  const perQueryResults = await Promise.all(
    uniqueQueries.map((query) =>
      searchEntriesHybrid(env, query, {
        topK: Math.max(maxResults, 6),
        semanticTopK: 30,
        lexicalLimit: 100,
        diversitySoftCap: 2,
      }),
    ),
  );

  // Reciprocal rank fusion across query variants improves topic coverage.
  const fused = new Map<
    string,
    {
      score: number;
      entry: { source: string; book: number; entry: string; text: string };
    }
  >();
  const rrfK = 30;

  for (const list of perQueryResults) {
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      const key = `${row.source}-${row.book}-${row.entry}`;
      const contribution = 1 / (rrfK + i + 1);
      const existing = fused.get(key);
      if (existing) {
        existing.score += contribution;
      } else {
        fused.set(key, {
          score: contribution,
          entry: {
            source: row.source,
            book: row.book,
            entry: row.entry,
            text: row.text,
          },
        });
      }
    }
  }

  return [...fused.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((item) => item.entry);
}

// ---------------------------------------------------------------------------
// Hono sub-app
// ---------------------------------------------------------------------------

export const notesApp = new Hono<{ Bindings: Bindings }>();

notesApp.get("/", (c) => {
  return c.html(renderNotesIndex());
});

notesApp.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const note = NOTES.find((n) => n.slug === slug);

  if (!note) {
    return c.html(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Not Found</title></head><body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;"><div style="text-align: center;"><h1>404</h1><p>Note not found.</p><a href="/notes">Back to Notes</a></div></body></html>`,
      404,
    );
  }

  // Fetch pinned entries from D1 (if any)
  const pinned: { source: string; book: number; entry: string; text: string }[] = [];
  if (note.pinnedEntries?.length) {
    const pinnedRows = await Promise.all(
      note.pinnedEntries.map((p) =>
        c.env.DB.prepare(
          "SELECT source, book, entry, text FROM entries WHERE source = ? AND book = ? AND entry = ?",
        )
          .bind(p.source, p.book, p.entry)
          .first<{ source: string; book: number; entry: string; text: string }>(),
      ),
    );
    for (const row of pinnedRows) {
      if (row) pinned.push(row);
    }
  }

  // Semantic search for relevant entries
  const searchResults = await searchEntries(c.env, note.searchQueries);

  // Merge: pinned first, then search results (excluding duplicates)
  const pinnedKeys = new Set(pinned.map((p) => `${p.source}-${p.book}-${p.entry}`));
  const entries = [...pinned, ...searchResults.filter((e) => !pinnedKeys.has(`${e.source}-${e.book}-${e.entry}`))];

  c.header("Cache-Control", "public, max-age=3600");
  return c.html(renderNotePage(note, entries));
});
