document.addEventListener("DOMContentLoaded", () => {
  // 画面切り替え要素
  const btnShowPlay = document.getElementById("btnShowPlay");
  const btnShowAdmin = document.getElementById("btnShowAdmin");
  const playView = document.getElementById("play-view");
  const adminView = document.getElementById("admin-view");

  // フォーム・一覧要素
  const quizForm = document.getElementById("quizForm");
  const questionInput = document.getElementById("questionInput");
  const choicesContainer = document.getElementById("choicesContainer");
  const addChoiceBtn = document.getElementById("addChoiceBtn");
  const adminMessage = document.getElementById("adminMessage");
  const quizList = document.getElementById("quizList");
  const quizCount = document.getElementById("quizCount");

  // --- モード切り替え ---
  btnShowPlay.addEventListener("click", () => {
    playView.classList.remove("hidden");
    adminView.classList.add("hidden");
    btnShowPlay.classList.add("active");
    btnShowAdmin.classList.remove("active");
  });

  btnShowAdmin.addEventListener("click", () => {
    adminView.classList.remove("hidden");
    playView.classList.add("hidden");
    btnShowAdmin.classList.add("active");
    btnShowPlay.classList.remove("active");
    loadQuizzes();
  });

  // --- 選択肢入力欄の動的生成 ---
  function addChoiceRow(value = "", isChecked = false) {
    const row = document.createElement("div");
    row.className = "choice-row";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "correctChoice";
    radio.checked = isChecked;
    radio.title = "この選択肢を正解にする";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "choice-input";
    input.placeholder = "選択肢を入力";
    input.value = value;
    input.required = true;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn-danger-outline btn-sm";
    delBtn.textContent = "削除";
    delBtn.addEventListener("click", () => {
      if (choicesContainer.children.length <= 2) {
        showMessage("選択肢は最低2つ必要です", true);
        return;
      }
      const wasChecked = radio.checked;
      row.remove();
      // 正解に指定されていた行を消した場合は先頭を正解にする
      if (wasChecked && choicesContainer.firstElementChild) {
        choicesContainer.firstElementChild.querySelector('input[type="radio"]').checked = true;
      }
    });

    row.append(radio, input, delBtn);
    choicesContainer.appendChild(row);
  }

  function resetFormChoices() {
    choicesContainer.innerHTML = "";
    addChoiceRow("", true);
    addChoiceRow("", false);
    addChoiceRow("", false);
    addChoiceRow("", false);
  }

  addChoiceBtn.addEventListener("click", () => {
    addChoiceRow("", false);
  });

  // --- クイズ投稿処理 ---
  quizForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    adminMessage.textContent = "";

    const question = questionInput.value.trim();
    const rows = Array.from(choicesContainer.querySelectorAll(".choice-row"));
    const choices = [];
    let answerIndex = -1;

    rows.forEach((row, idx) => {
      const text = row.querySelector(".choice-input").value.trim();
      const checked = row.querySelector('input[type="radio"]').checked;
      choices.push(text);
      if (checked) {
        answerIndex = idx;
      }
    });

    if (!question || choices.length < 2 || choices.some((c) => !c) || answerIndex < 0) {
      showMessage("問題文・すべての選択肢・正解を入力してください", true);
      return;
    }

    try {
      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          choices,
          answer_index: answerIndex,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "投稿に失敗しました");
      }

      questionInput.value = "";
      resetFormChoices();
      showMessage("クイズを投稿しました", false);
      await loadQuizzes();
    } catch (err) {
      showMessage(err.message, true);
    }
  });

  // --- クイズ一覧取得・描画 ---
  async function loadQuizzes() {
    try {
      const res = await fetch("/api/quizzes");
      if (!res.ok) throw new Error("一覧の取得に失敗しました");
      const quizzes = await res.json();

      quizCount.textContent = `${quizzes.length}問`;
      quizList.innerHTML = "";

      if (quizzes.length === 0) {
        quizList.innerHTML = '<p class="muted">登録されているクイズはまだありません。</p>';
        return;
      }

      quizzes.forEach((quiz) => {
        const item = document.createElement("div");
        item.className = "quiz-item";

        const choicesHtml = quiz.choices
          .map((c, idx) => {
            const isCorrect = idx === quiz.answer_index;
            return `<li class="${isCorrect ? "correct-choice" : ""}">
              ${escapeHtml(c)} ${isCorrect ? '<span class="correct-tag">正解</span>' : ""}
            </li>`;
          })
          .join("");

        item.innerHTML = `
          <div class="quiz-item-header">
            <span class="quiz-id">Q${quiz.id}.</span>
            <p class="quiz-question">${escapeHtml(quiz.question)}</p>
            <button type="button" class="btn btn-danger btn-sm delete-quiz-btn">削除</button>
          </div>
          <ul class="quiz-choices-preview">${choicesHtml}</ul>
        `;

        item.querySelector(".delete-quiz-btn").addEventListener("click", async () => {
          if (!confirm(`「${quiz.question}」を削除しますか？`)) return;
          await deleteQuiz(quiz.id);
        });

        quizList.appendChild(item);
      });
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  // --- クイズ削除 ---
  async function deleteQuiz(id) {
    try {
      const res = await fetch(`/api/quizzes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除に失敗しました");
      await loadQuizzes();
    } catch (err) {
      showMessage(err.message, true);
    }
  }

  function showMessage(msg, isError) {
    adminMessage.textContent = msg;
    adminMessage.className = `status-msg ${isError ? "error" : "success"}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // 初期セットアップ
  resetFormChoices();
  loadQuizzes();
});