// クイズデータ（APIから取得する）
let questions = [];

// 現在の問題番号と得点
let currentQuestion = 0;
let score = 0;
let playerName = "";

// 保存した自分のスコア情報
let savedScore = null;

// HTML要素を取得
const startView = document.querySelector("#start-view");
const quizView = document.querySelector("#quiz-view");
const resultView = document.querySelector("#result-view");

const playerNameInput = document.querySelector("#player-name");
const startButton = document.querySelector("#start-button");

const questionNumber = document.querySelector("#question-number");
const questionText = document.querySelector("#question-text");
const choicesArea = document.querySelector("#choices");
const feedback = document.querySelector("#answer-feedback");

const finalScore = document.querySelector("#final-score");
const averageScore = document.querySelector("#average-score");
const rankingArea = document.querySelector("#ranking");

// クイズ開始
startButton.addEventListener("click", startQuiz);

async function startQuiz() {
    playerName = playerNameInput.value.trim();

    if (!playerName) {
        alert("プレイヤー名を入力してください");
        return;
    }

    // 問題取得中に二重クリックできないようにする
    startButton.disabled = true;

    try {
        // DBからクイズ一覧を取得
        const response = await fetch("/api/quizzes");

        if (!response.ok) {
            throw new Error("クイズの取得に失敗しました");
        }

        questions = await response.json();

        if (questions.length === 0) {
            alert("まだ問題が登録されていません");
            return;
        }

        // ゲームの状態を初期化
        currentQuestion = 0;
        score = 0;
        savedScore = null;

        startView.hidden = true;
        quizView.hidden = false;
        resultView.hidden = true;

        showQuestion();

    } catch (error) {
        console.error(error);
        alert("クイズを取得できませんでした。時間をおいて再度お試しください。");

    } finally {
        startButton.disabled = false;
    }
}

// 問題を表示する
function showQuestion() {
    const q = questions[currentQuestion];

    questionNumber.textContent =
        `問題 ${currentQuestion + 1} / ${questions.length}`;

    questionText.textContent = q.question;
    feedback.textContent = "";
    choicesArea.innerHTML = "";

    q.choices.forEach((choice, index) => {
        const button = document.createElement("button");

        button.textContent = choice;
        button.type = "button";

        button.addEventListener("click", () => {
            checkAnswer(index);
        });

        choicesArea.appendChild(button);
    });
}

// 回答の正誤判定
function checkAnswer(selectedIndex) {
    const q = questions[currentQuestion];
    const buttons = choicesArea.querySelectorAll("button");

    // 回答後は選択肢を押せないようにする
    buttons.forEach(button => {
        button.disabled = true;
    });

    // APIのanswer_indexを使って正誤判定
    if (selectedIndex === q.answer_index) {
        score++;
        feedback.textContent = "正解！";
    } else {
        feedback.textContent =
            `不正解！正解は「${q.choices[q.answer_index]}」です。`;
    }

    // 次の問題へ進むボタン
    const nextButton = document.createElement("button");

    nextButton.textContent =
        currentQuestion + 1 === questions.length
            ? "結果を見る"
            : "次の問題へ";

    nextButton.type = "button";

    nextButton.addEventListener("click", () => {
        currentQuestion++;

        if (currentQuestion < questions.length) {
            showQuestion();
        } else {
            showResult();
        }
    });

    choicesArea.appendChild(nextButton);
}

// 結果を表示する
async function showResult() {
    quizView.hidden = true;
    resultView.hidden = false;

    finalScore.textContent =
        `${playerName} さんの得点：${score} / ${questions.length}点`;

    averageScore.textContent = "全体平均を取得中...";
    rankingArea.textContent = "ランキングを取得中...";

    try {
        // 自分のスコアをDBに保存
        const saveResponse = await fetch("/api/scores", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                player_name: playerName,
                score: score,
                total: questions.length
            })
        });

        if (!saveResponse.ok) {
            throw new Error("スコアの保存に失敗しました");
        }

        savedScore = await saveResponse.json();

        // DBから全員のスコアを取得
        const scoresResponse = await fetch("/api/scores");

        if (!scoresResponse.ok) {
            throw new Error("ランキングの取得に失敗しました");
        }

        const allScores = await scoresResponse.json();

        // 正答率を計算する関数
        const getRate = user => user.score / user.total;

        // 正答率の高い順に並べる
        allScores.sort((a, b) => getRate(b) - getRate(a));

        // 全員の平均正答率を計算
        const average =
            allScores.reduce((sum, user) => sum + getRate(user), 0)
            / allScores.length;

        averageScore.textContent =
            `全体平均正答率：${(average * 100).toFixed(1)}%`;

        // 自分より正答率が高い人の人数から順位を計算
        const myRate = getRate(savedScore);

        const rank = allScores.filter(
            user => getRate(user) > myRate
        ).length + 1;

        // ランキング表示
        rankingArea.innerHTML = "";

        allScores.forEach(user => {
            const item = document.createElement("p");

            item.textContent =
                `${user.player_name}：${user.score} / ${user.total}点`;

            // 今回保存した自分の記録を強調表示
            if (user.id === savedScore.id) {
                item.textContent += " ← あなた";
                item.style.fontWeight = "bold";
            }

            rankingArea.appendChild(item);
        });

        // 自分の順位を表示
        const rankMessage = document.createElement("p");
        rankMessage.textContent = `あなたの順位：${rank}位`;

        rankingArea.prepend(rankMessage);

    } catch (error) {
        console.error(error);

        averageScore.textContent = "平均を取得できませんでした";
        rankingArea.textContent =
            "スコアの保存またはランキングの取得に失敗しました。";
    }
}
