const express = require("express");

const app = express();
const port = 3000;

app.use(express.json({ limit: "256kb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

const questions = [
  {
    id: "Q1",
    dimension: "EI",
    aLetter: "E",
    bLetter: "I",
    aText: "我更喜欢先开口和陌生人交流。",
    bText: "我更喜欢先观察，再决定要不要交流。",
  },
  {
    id: "Q2",
    dimension: "EI",
    aLetter: "E",
    bLetter: "I",
    aText: "长时间社交后，我通常会更有精力。",
    bText: "长时间社交后，我通常需要独处恢复。",
  },
  {
    id: "Q3",
    dimension: "EI",
    aLetter: "E",
    bLetter: "I",
    aText: "我更倾向于边说边整理想法。",
    bText: "我更倾向于先想清楚再表达。",
  },
  {
    id: "Q4",
    dimension: "EI",
    aLetter: "E",
    bLetter: "I",
    aText: "团队活动通常会让我更投入。",
    bText: "单人任务通常会让我更投入。",
  },
  {
    id: "Q5",
    dimension: "SN",
    aLetter: "S",
    bLetter: "N",
    aText: "我更关注事实和可验证的信息。",
    bText: "我更关注概念和可能性。",
  },
  {
    id: "Q6",
    dimension: "SN",
    aLetter: "S",
    bLetter: "N",
    aText: "做决定时，我更依赖过往经验。",
    bText: "做决定时，我更愿意尝试新方法。",
  },
  {
    id: "Q7",
    dimension: "SN",
    aLetter: "S",
    bLetter: "N",
    aText: "我更喜欢明确具体的说明。",
    bText: "我更喜欢开放探索的方向。",
  },
  {
    id: "Q8",
    dimension: "SN",
    aLetter: "S",
    bLetter: "N",
    aText: "我更容易注意到细节和步骤。",
    bText: "我更容易注意到趋势和模式。",
  },
  {
    id: "Q9",
    dimension: "TF",
    aLetter: "T",
    bLetter: "F",
    aText: "做判断时，我更看重逻辑一致性。",
    bText: "做判断时，我更看重人的感受。",
  },
  {
    id: "Q10",
    dimension: "TF",
    aLetter: "T",
    bLetter: "F",
    aText: "反馈时，我倾向于直指问题。",
    bText: "反馈时，我倾向于照顾对方感受。",
  },
  {
    id: "Q11",
    dimension: "TF",
    aLetter: "T",
    bLetter: "F",
    aText: "我更容易被“正确性”说服。",
    bText: "我更容易被“价值感”打动。",
  },
  {
    id: "Q12",
    dimension: "TF",
    aLetter: "T",
    bLetter: "F",
    aText: "冲突中，我更想先厘清事实。",
    bText: "冲突中，我更想先修复关系。",
  },
  {
    id: "Q13",
    dimension: "JP",
    aLetter: "J",
    bLetter: "P",
    aText: "我喜欢提前规划并按计划推进。",
    bText: "我喜欢保持弹性并随情况调整。",
  },
  {
    id: "Q14",
    dimension: "JP",
    aLetter: "J",
    bLetter: "P",
    aText: "截止日期前，我通常会提前完成。",
    bText: "截止日期前，我通常在后段冲刺。",
  },
  {
    id: "Q15",
    dimension: "JP",
    aLetter: "J",
    bLetter: "P",
    aText: "我更偏好任务有明确的收尾感。",
    bText: "我更偏好任务保持开放探索空间。",
  },
  {
    id: "Q16",
    dimension: "JP",
    aLetter: "J",
    bLetter: "P",
    aText: "出行时，我更喜欢提前定好行程。",
    bText: "出行时，我更喜欢走到哪算哪。",
  },
];

const submissions = [];
let submissionCounter = 0;

const mbtiDescriptions = {
  INTJ: "策略型规划者",
  INTP: "逻辑型探索者",
  ENTJ: "果断型组织者",
  ENTP: "创意型挑战者",
  INFJ: "洞察型引导者",
  INFP: "理想型共情者",
  ENFJ: "感染型协调者",
  ENFP: "热情型连接者",
  ISTJ: "稳健型执行者",
  ISFJ: "守护型支持者",
  ESTJ: "管理型推进者",
  ESFJ: "协作型关怀者",
  ISTP: "务实型解决者",
  ISFP: "温和型体验者",
  ESTP: "行动型实践者",
  ESFP: "活力型表达者",
};

function sanitizeName(name) {
  if (typeof name !== "string") {
    return "匿名";
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return "匿名";
  }
  return trimmed.slice(0, 40);
}

function isValidAnswers(answers) {
  if (!answers || typeof answers !== "object") {
    return false;
  }
  return questions.every((question) => {
    return answers[question.id] === "A" || answers[question.id] === "B";
  });
}

function calculateMbti(answers) {
  const scores = {
    E: 0,
    I: 0,
    S: 0,
    N: 0,
    T: 0,
    F: 0,
    J: 0,
    P: 0,
  };

  for (const question of questions) {
    const choice = answers[question.id];
    if (choice === "A") {
      scores[question.aLetter] += 1;
    } else {
      scores[question.bLetter] += 1;
    }
  }

  return [
    scores.E >= scores.I ? "E" : "I",
    scores.S >= scores.N ? "S" : "N",
    scores.T >= scores.F ? "T" : "F",
    scores.J >= scores.P ? "J" : "P",
  ].join("");
}

function buildQuestionMarkup() {
  return questions
    .map((question, index) => {
      return `
        <fieldset class="question-card">
          <legend>${index + 1}. [${question.dimension}] ${question.id}</legend>
          <label class="option">
            <input type="radio" name="${question.id}" value="A" required />
            <span>A. ${question.aText}</span>
          </label>
          <label class="option">
            <input type="radio" name="${question.id}" value="B" required />
            <span>B. ${question.bText}</span>
          </label>
        </fieldset>
      `;
    })
    .join("");
}

function renderSurveyPage() {
  return `
    <!doctype html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>WBTI MBTI 问卷</title>
      <style>
        :root {
          --ink: #1f2937;
          --muted: #5b6472;
          --surface: #ffffff;
          --brand: #0f766e;
          --line: #d6dde7;
          --bg: radial-gradient(circle at top right, #d8f7f3, #f7fafc 55%);
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
          color: var(--ink);
          background: var(--bg);
          min-height: 100vh;
        }
        .page {
          max-width: 860px;
          margin: 0 auto;
          padding: 20px 16px 48px;
        }
        .hero {
          background: var(--surface);
          border: 1px solid rgba(15, 118, 110, 0.2);
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 12px 30px rgba(15, 118, 110, 0.08);
          margin-bottom: 18px;
        }
        h1 {
          margin: 0 0 8px;
          font-size: 1.6rem;
        }
        .sub {
          margin: 0;
          color: var(--muted);
          font-size: 0.95rem;
        }
        .progress {
          margin: 14px 0 0;
          font-size: 0.92rem;
          color: #0f766e;
          font-weight: 600;
        }
        form {
          display: grid;
          gap: 12px;
        }
        .name-row {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 12px;
        }
        .name-row label {
          display: block;
          margin-bottom: 8px;
          font-size: 0.92rem;
          color: var(--muted);
        }
        .name-row input {
          width: 100%;
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 1rem;
        }
        .question-card {
          margin: 0;
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 12px;
          background: var(--surface);
        }
        .question-card legend {
          font-weight: 700;
          color: #0f172a;
          padding: 0 6px;
        }
        .option {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          border: 1px solid #e8edf5;
          border-radius: 10px;
          padding: 10px;
          margin-top: 8px;
          background: #fbfcfe;
        }
        .option input {
          margin-top: 2px;
        }
        .option span {
          line-height: 1.45;
        }
        button[type="submit"] {
          border: none;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 1rem;
          font-weight: 700;
          color: #fff;
          background: linear-gradient(120deg, var(--brand), #0891b2);
        }
        button[type="submit"][disabled] {
          opacity: 0.5;
        }
        .result {
          margin-top: 14px;
          background: #0f172a;
          color: #f8fafc;
          border-radius: 12px;
          padding: 16px;
        }
        .result h2 {
          margin: 0 0 8px;
          font-size: 1.2rem;
        }
        .result p {
          margin: 0;
          line-height: 1.5;
        }
        .tip {
          margin-top: 12px;
          font-size: 0.86rem;
          color: #94a3b8;
        }
        .warn {
          margin-top: 8px;
          color: #b45309;
          font-size: 0.9rem;
          min-height: 1.2em;
        }
      </style>
    </head>
    <body>
      <main class="page">
        <section class="hero">
          <h1>WBTI MBTI 问卷</h1>
          <p class="sub">共 16 题，约 2~4 分钟。请根据第一反应作答。</p>
          <div id="progressText" class="progress">已完成 0/${questions.length} 题</div>
          <div id="warningText" class="warn"></div>
        </section>

        <form id="surveyForm">
          <div class="name-row">
            <label for="name">昵称（可选，最多 40 字）</label>
            <input id="name" name="name" type="text" maxlength="40" placeholder="例如：产品组-小李" />
          </div>
          ${buildQuestionMarkup()}
          <button id="submitButton" type="submit" disabled>提交问卷</button>
        </form>

        <section id="resultCard" class="result" hidden>
          <h2>提交成功</h2>
          <p id="resultText"></p>
          <p class="tip">你可以关闭此页面，结果已写入收集看板。</p>
        </section>
      </main>

      <script>
        (() => {
          const totalQuestions = ${questions.length};
          const form = document.getElementById("surveyForm");
          const progressText = document.getElementById("progressText");
          const submitButton = document.getElementById("submitButton");
          const warningText = document.getElementById("warningText");
          const resultCard = document.getElementById("resultCard");
          const resultText = document.getElementById("resultText");

          function updateProgress() {
            const formData = new FormData(form);
            let answered = 0;
            for (let i = 1; i <= totalQuestions; i += 1) {
              if (formData.get("Q" + i)) {
                answered += 1;
              }
            }
            progressText.textContent = "已完成 " + answered + "/" + totalQuestions + " 题";
            submitButton.disabled = answered !== totalQuestions;
            warningText.textContent = "";
          }

          form.addEventListener("change", updateProgress);

          form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const answers = {};

            for (let i = 1; i <= totalQuestions; i += 1) {
              const key = "Q" + i;
              answers[key] = formData.get(key);
            }

            submitButton.disabled = true;
            submitButton.textContent = "提交中...";
            warningText.textContent = "";

            try {
              const response = await fetch("/api/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: formData.get("name") || "",
                  answers,
                }),
              });

              const payload = await response.json();

              if (!response.ok) {
                throw new Error(payload.error || "提交失败，请稍后重试");
              }

              resultText.textContent =
                "你的类型是 " +
                payload.mbti +
                "（" +
                payload.label +
                "）。感谢参与，编号 #" +
                payload.id +
                "。";
              form.hidden = true;
              resultCard.hidden = false;
              window.scrollTo({ top: 0, behavior: "smooth" });
            } catch (error) {
              warningText.textContent = error.message;
              submitButton.disabled = false;
              submitButton.textContent = "提交问卷";
            }
          });
        })();
      </script>
    </body>
    </html>
  `;
}

app.get("/", (req, res) => {
  res.send(renderSurveyPage());
});

app.post("/api/submit", (req, res) => {
  const name = sanitizeName(req.body?.name);
  const answers = req.body?.answers;

  if (!isValidAnswers(answers)) {
    res.status(400).json({ error: "答案不完整或格式错误，请返回重试。" });
    return;
  }

  const mbti = calculateMbti(answers);
  const createdAt = new Date().toISOString();

  submissionCounter += 1;
  submissions.push({
    id: submissionCounter,
    name,
    mbti,
    createdAt,
    answers,
  });

  res.json({
    ok: true,
    id: submissionCounter,
    name,
    mbti,
    label: mbtiDescriptions[mbti] || "复合型",
  });
});

app.get("/api/stats", (req, res) => {
  const byType = {};
  for (const submission of submissions) {
    byType[submission.mbti] = (byType[submission.mbti] || 0) + 1;
  }

  res.json({
    total: submissions.length,
    byType,
    recent: submissions
      .slice(-12)
      .reverse()
      .map((submission) => {
        return {
          id: submission.id,
          name: submission.name,
          mbti: submission.mbti,
          createdAt: submission.createdAt,
        };
      }),
  });
});

app.listen(port, () => {
  console.log("WBTI survey server listening on port " + port);
});
