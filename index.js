import express from "express";
import { Sequelize, DataTypes } from "sequelize";
import session from "express-session";
import SequelizeStoreFactory from "connect-session-sequelize";
import bcrypt from "bcryptjs";
import "dotenv/config";
import serverless from "serverless-http";
const app = express();
const PORT = process.env.PORT || 3000;
const SequelizeStore = SequelizeStoreFactory(session.Store);

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
const sequelize = new Sequelize(
  process.env.DATABASE_URL,
  {
    dialect: "postgres",
    logging: false,
  }
);

// ...
const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: "sessions",
});
await sessionStore.sync();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});
const Teacher = sequelize.define("teacher", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  education: {
    type: DataTypes.TEXT,
  },
  schedule: {
    type: DataTypes.TEXT,
  },
});

const Question = sequelize.define("question", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  blooms_level: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  question_text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
});

Teacher.hasMany(Question, { foreignKey: "teacher_id" });
Question.belongsTo(Teacher, { foreignKey: "teacher_id" });
const bloomsData = {
  Remember: [
    "arrange", "count", "define", "describe", "draw", "duplicate", 
    "enumerate", "find", "identify", "know", "label", "list", 
    "locate", "match", "name", "outline", "recall", "recognize", 
    "relate", "repeat", "reproduce", "select", "sequence", "state", 
    "tell", "write"
  ],
  Understand: [
    "classify", "compare", "comprehend", "convert", "defend", 
    "demonstrate", "describe", "discuss", "distinguish", "estimate", 
    "explain", "express", "extend", "generalize", "give examples", 
    "illustrate", "indicate", "infer", "interpret", "locate", 
    "paraphrase", "predict", "recognize", "rewrite", "select", 
    "summarize", "translate"
  ],
  Apply: [
    "apply", "build", "calculate", "change", "choose", "complete", 
    "compute", "construct", "demonstrate", "develop", "discover", 
    "dramatize", "employ", "examine", "experiment", "illustrate", 
    "interpret", "manipulate", "modify", "operate", "organize", 
    "practice", "predict", "prepare", "produce", "relate", "schedule", 
    "select", "show", "sketch", "solve", "use", "utilize"
  ],
  Analyze: [
    "analyze", "arrange", "breakdown", "categorize", "classify", 
    "compare", "contrast", "correlate", "diagram", "differentiate", 
    "discriminate", "distinguish", "examine", "explain", "focus", 
    "illustrate", "infer", "investigate", "limit", "outline", 
    "point out", "prioritize", "recognize", "separate", "subdivide"
  ],
  Evaluate: [
    "appraise", "argue", "assess", "attach", "choose", "compare", 
    "conclude", "contrast", "criticize", "critique", "decide", 
    "defend", "estimate", "evaluate", "grade", "interpret", "judge", 
    "justify", "measure", "prioritize", "prove", "rank", "rate", 
    "recommend", "select", "support", "test", "validate", "value"
  ],
  Create: [
    "adapt", "anticipate", "arrange", "assemble", "categorize", 
    "collaborate", "collect", "combine", "compile", "compose", 
    "construct", "create", "design", "develop", "devise", "express", 
    "facilitate", "formulate", "generate", "imagine", "incorporate", 
    "integrate", "invent", "make", "modify", "organize", "originate", 
    "plan", "prepare", "produce", "propose", "rearrange", "reconstruct", 
    "reorganize", "revise", "rewrite", "set up", "structure", "synthesize", 
    "validate", "write"
  ]
};

const restrictedWords = [
  "believe", "hear", "realize", "capacity", "intelligence", 
  "recognize", "comprehend", "know", "see", "conceptualize",
  "listen", "self-actualize", "memorize", "think", "experience",
  "perceive", "understand", "feel"
];

const restrictedPhrases = [
  "what is", "define", "name the", "state the meaning of",
  "who is", "when did", "where is", "list the", "identify the",
  "evidence a", "evidence an", "to become", "to reduce",
  "appreciation for", "acquainted with", "adjusted to",
  "awareness of", "capable of", "comprehension of", "cognizant of",
  "enjoyment of", "conscious of", "familiar with",
  "interest in", "interested in", "knowledge of",
  "understanding of", "knowledgeable about"
];

const isAuth = (req, res, next) => {
  if (req.session.teacherId) {
    next();
  } else {
    res.redirect("/login");
  }
};

const isGuest = (req, res, next) => {
  if (req.session.teacherId) {
    res.redirect("/profile");
  } else {
    next();
  }
};

app.get("/", (req, res) => {
  if (req.session.teacherId) {
    res.redirect("/profile");
  } else {
    res.redirect("/login");
  }
});

app.get("/register", isGuest, (req, res) => {
  res.render("pages/register", { error: null, oldInput: {} });
});

app.post("/register", isGuest, async (req, res) => {
  const { name, email, password, education, schedule } = req.body;

  try {
    const existingTeacher = await Teacher.findOne({ where: { email } });
    if (existingTeacher) {
      return res.render("pages/register", {
        error: "An account with this email already exists.",
        oldInput: { name, email, education, schedule },
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await Teacher.create({
      name,
      email,
      password: hashedPassword,
      education,
      schedule,
    });
    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.render("pages/register", {
      error: "Registration failed. Please try again.",
      oldInput: { name, email, education, schedule },
    });
  }
});

app.get("/login", isGuest, (req, res) => {
  res.render("pages/login", { error: null });
});

app.post("/login", isGuest, async (req, res) => {
  const { email, password } = req.body;
  try {
    const teacher = await Teacher.findOne({ where: { email } });
    if (!teacher) {
      return res.render("pages/login", { error: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, teacher.password);
    if (!isMatch) {
      return res.render("pages/login", { error: "Invalid email or password." });
    }

    req.session.teacherId = teacher.id;
    req.session.teacherName = teacher.name;
    res.redirect("/profile");
  } catch (err) {
    console.error(err);
    res.render("pages/login", { error: "Login failed. Please try again." });
  }
});

app.get("/logout", isAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    }
    res.redirect("/login");
  });
});

app.get("/profile", isAuth, async (req, res) => {
  try {
    const teacher = await Teacher.findByPk(req.session.teacherId);
    if (!teacher) {
      return res.redirect("/logout");
    }
    res.render("pages/profile", { teacher });
  } catch (err) {
    console.error(err);
    res.redirect("/login");
  }
});

app.get("/question/create", isAuth, (req, res) => {
  res.render("pages/createQuestion", {
    bloomsData,
    error: null,
    success: null,
    oldInput: {},
  });
});

app.post("/question/create", isAuth, async (req, res) => {
  const { blooms_level, question_text } = req.body;
  const teacher_id = req.session.teacherId;

  const lowerQ = question_text.toLowerCase();
  const keywords = bloomsData[blooms_level] || [];

  const restrictedPhraseFound = restrictedPhrases.find((p) =>
    lowerQ.includes(p.toLowerCase())
  );
  if (restrictedPhraseFound) {
    return res.render("pages/createQuestion", {
      bloomsData,
      error: `Validation Failed: Question contains the restricted phrase '${restrictedPhraseFound}'.`,
      success: null,
      oldInput: { blooms_level, question_text },
    });
  }

  const questionWords = lowerQ.split(/[\s,.;:!?]+/);
  const restrictedWordFound = restrictedWords.find((restrictedWord) =>
    questionWords.includes(restrictedWord.toLowerCase())
  );

  if (restrictedWordFound) {
    return res.render("pages/createQuestion", {
      bloomsData,
      error: `Validation Failed: Question contains the unmeasurable word '${restrictedWordFound}'. These verbs (like 'know', 'understand') are hard to assess.`,
      success: null,
      oldInput: { blooms_level, question_text },
    });
  }

  const hasKeyword = keywords.some((k) => lowerQ.includes(k.toLowerCase()));
  if (!hasKeyword) {
    const keywordExamples = keywords.slice(0, 3).join(", ");
    return res.render("pages/createQuestion", {
      bloomsData,
      error: `Validation Failed: Question must include at least one keyword for the '${blooms_level}' level (e.g., ${keywordExamples}).`,
      success: null,
      oldInput: { blooms_level, question_text },
    });
  }

  try {
    await Question.create({
      teacher_id,
      blooms_level,
      question_text,
    });

    res.render("pages/createQuestion", {
      bloomsData,
      error: null,
      success: "Question saved successfully!",
      oldInput: {},
    });
  } catch (err) {
    console.error(err);
    res.render("pages/createQuestion", {
      bloomsData,
      error: "Error saving question to the database. Please try again.",
      success: null,
      oldInput: { blooms_level, question_text },
    });
  }
});

app.get("/question/list", isAuth, async (req, res) => {
  try {
    const questions = await Question.findAll({
      where: { teacher_id: req.session.teacherId },
      order: [["createdAt", "DESC"]],
    });
    res.render("pages/listQuestions", { questions });
  } catch (err) {
    console.error(err);
    res.render("pages/listQuestions", { questions: [] });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


export const handler = serverless(app);
