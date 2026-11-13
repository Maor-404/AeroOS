#include <QApplication>
#include <QColor>
#include <QDir>
#include <QKeySequence>
#include <QLabel>
#include <QLineEdit>
#include <QMainWindow>
#include <QPushButton>
#include <QShortcut>
#include <QStandardPaths>
#include <QTabWidget>
#include <QToolBar>
#include <QUrl>
#include <QVBoxLayout>
#include <QWebEnginePage>
#include <QWebEngineProfile>
#include <QWebEngineSettings>
#include <QWebEngineView>
#include <QWidget>
#include <QString>

static const char *HOME_URL = "https://duckduckgo.com";

static const char *AERO_QSS = R"(
QMainWindow {
    background-color: #071422;
    color: #f0f9ff;
}
QToolBar {
    background-color: #0a1c2e;
    border-bottom: 1px solid #1b3b5a;
    spacing: 6px;
    padding: 6px 10px;
}
QPushButton#navBtn {
    background-color: #0f273d;
    color: #dbeafe;
    border: 1px solid #1e4264;
    border-radius: 7px;
    padding: 5px 10px;
    font-weight: 600;
    min-width: 28px;
}
QPushButton#navBtn:hover {
    background-color: #163754;
    border-color: #38bdf8;
    color: #ffffff;
}
QLineEdit#urlBar {
    background-color: #06111c;
    color: #f0f9ff;
    border: 1px solid #1e4264;
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 13px;
}
QLineEdit#urlBar:focus {
    border: 1px solid #38bdf8;
}
QTabWidget::pane {
    border: none;
    background-color: #071422;
}
QTabBar::tab {
    background-color: #091828;
    color: #94b8d0;
    padding: 7px 14px;
    margin-right: 3px;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    min-width: 120px;
    max-width: 220px;
}
QTabBar::tab:selected {
    background-color: #0f273d;
    color: #f0f9ff;
    border-bottom: 2px solid #38bdf8;
}
)";

static QUrl normalizeUrl(const QString &raw) {
    QString text = raw.trimmed();
    if (text.isEmpty()) {
        return QUrl(QString::fromLatin1(HOME_URL));
    }
    if (text.contains("://")) {
        return QUrl(text);
    }
    if (text.contains('.') && !text.contains(' ')) {
        return QUrl("https://" + text);
    }
    return QUrl("https://duckduckgo.com/?q=" + QString::fromUtf8(QUrl::toPercentEncoding(text)));
}

class AeroBrowserWindow : public QMainWindow {
public:
    explicit AeroBrowserWindow(const QString &initialUrl, bool appMode) : m_appMode(appMode) {
        setWindowTitle(appMode ? "AeroOS Control Hub" : "Aero Browser");
        resize(appMode ? 1140 : 1240, appMode ? 740 : 820);
        setStyleSheet(QString::fromUtf8(AERO_QSS));

        m_profile = QWebEngineProfile::defaultProfile();
        QString dataPath = QStandardPaths::writableLocation(QStandardPaths::GenericDataLocation) + "/aeroos/browser";
        QDir().mkpath(dataPath);
        m_profile->setPersistentStoragePath(dataPath);
        m_profile->setCachePath(dataPath + "/cache");

        QWebEngineSettings *settings = m_profile->settings();
        settings->setAttribute(QWebEngineSettings::PluginsEnabled, false);
        settings->setAttribute(QWebEngineSettings::JavascriptCanAccessClipboard, false);
        settings->setAttribute(QWebEngineSettings::LocalStorageEnabled, true);
        settings->setAttribute(QWebEngineSettings::ScrollAnimatorEnabled, true);

        if (m_appMode) {
            auto *view = new QWebEngineView(this);
            auto *page = new QWebEnginePage(m_profile, view);
            view->setPage(page);
            page->setBackgroundColor(QColor("#071422"));
            connect(view, &QWebEngineView::titleChanged, this, [this](const QString &t) {
                if (!t.isEmpty()) setWindowTitle(t);
            });
            view->load(normalizeUrl(initialUrl));
            setCentralWidget(view);
            return;
        }

        m_tabs = new QTabWidget(this);
        m_tabs->setDocumentMode(true);
        m_tabs->setTabsClosable(true);
        connect(m_tabs, &QTabWidget::tabCloseRequested, this, &AeroBrowserWindow::closeTab);
        connect(m_tabs, &QTabWidget::currentChanged, this, &AeroBrowserWindow::syncUrlBar);

        auto *toolbar = addToolBar("Navigation");
        toolbar->setMovable(false);

        auto *backBtn = new QPushButton("←", this);
        backBtn->setObjectName("navBtn");
        connect(backBtn, &QPushButton::clicked, this, [this]() {
            if (auto *v = currentView()) v->back();
        });

        auto *fwdBtn = new QPushButton("→", this);
        fwdBtn->setObjectName("navBtn");
        connect(fwdBtn, &QPushButton::clicked, this, [this]() {
            if (auto *v = currentView()) v->forward();
        });

        auto *reloadBtn = new QPushButton("↻", this);
        reloadBtn->setObjectName("navBtn");
        connect(reloadBtn, &QPushButton::clicked, this, [this]() {
            if (auto *v = currentView()) v->reload();
        });

        auto *homeBtn = new QPushButton("⌂", this);
        homeBtn->setObjectName("navBtn");
        connect(homeBtn, &QPushButton::clicked, this, [this]() {
            navigateTo(QString::fromLatin1(HOME_URL));
        });

        m_tlsBadge = new QLabel("HTTPS", this);
        m_tlsBadge->setStyleSheet("color: #34d399; font-weight: 600; padding: 0 6px;");

        m_urlBar = new QLineEdit(this);
        m_urlBar->setObjectName("urlBar");
        m_urlBar->setPlaceholderText("Search DuckDuckGo or enter URL...");
        connect(m_urlBar, &QLineEdit::returnPressed, this, [this]() {
            navigateTo(m_urlBar->text());
        });

        auto *newTabBtn = new QPushButton("+", this);
        newTabBtn->setObjectName("navBtn");
        connect(newTabBtn, &QPushButton::clicked, this, [this]() {
            addTab(QString::fromLatin1(HOME_URL));
        });

        toolbar->addWidget(backBtn);
        toolbar->addWidget(fwdBtn);
        toolbar->addWidget(reloadBtn);
        toolbar->addWidget(homeBtn);
        toolbar->addWidget(m_tlsBadge);
        toolbar->addWidget(m_urlBar);
        toolbar->addWidget(newTabBtn);

        setCentralWidget(m_tabs);

        new QShortcut(QKeySequence("Ctrl+T"), this, [this]() { addTab(QString::fromLatin1(HOME_URL)); });
        new QShortcut(QKeySequence("Ctrl+W"), this, [this]() { closeTab(m_tabs->currentIndex()); });
        new QShortcut(QKeySequence("Ctrl+L"), this, [this]() {
            m_urlBar->setFocus();
            m_urlBar->selectAll();
        });
        new QShortcut(QKeySequence("Ctrl+R"), this, [this]() {
            if (auto *v = currentView()) v->reload();
        });

        addTab(initialUrl);
    }

private:
    QWebEngineView *currentView() const {
        return m_tabs ? qobject_cast<QWebEngineView *>(m_tabs->currentWidget()) : nullptr;
    }

    void addTab(const QString &url) {
        auto *view = new QWebEngineView(m_tabs);
        auto *page = new QWebEnginePage(m_profile, view);
        view->setPage(page);
        page->setBackgroundColor(QColor("#071422"));
        view->load(normalizeUrl(url));

        int idx = m_tabs->addTab(view, "New Tab");
        m_tabs->setCurrentIndex(idx);

        connect(view, &QWebEngineView::titleChanged, this, [this, view](const QString &title) {
            int i = m_tabs->indexOf(view);
            if (i >= 0) {
                m_tabs->setTabText(i, title.isEmpty() ? "Tab" : title.left(24));
                if (i == m_tabs->currentIndex()) {
                    setWindowTitle((title.isEmpty() ? "Aero Browser" : title) + " — Aero Browser");
                }
            }
        });
        connect(view, &QWebEngineView::urlChanged, this, [this, view](const QUrl &u) {
            if (view == currentView()) updateUrlDisplay(u);
        });
    }

    void closeTab(int idx) {
        if (m_tabs->count() <= 1) {
            close();
            return;
        }
        QWidget *w = m_tabs->widget(idx);
        m_tabs->removeTab(idx);
        if (w) w->deleteLater();
    }

    void syncUrlBar(int idx) {
        if (auto *v = qobject_cast<QWebEngineView *>(m_tabs->widget(idx))) {
            updateUrlDisplay(v->url());
        }
    }

    void updateUrlDisplay(const QUrl &u) {
        m_urlBar->setText(u.toString());
        if (u.scheme() == "https") {
            m_tlsBadge->setText("HTTPS");
            m_tlsBadge->setStyleSheet("color: #34d399; font-weight: 600; padding: 0 6px;");
        } else if (u.scheme() == "http") {
            m_tlsBadge->setText("HTTP");
            m_tlsBadge->setStyleSheet("color: #fbbf24; font-weight: 600; padding: 0 6px;");
        } else {
            m_tlsBadge->setText("LOCAL");
            m_tlsBadge->setStyleSheet("color: #38bdf8; font-weight: 600; padding: 0 6px;");
        }
    }

    void navigateTo(const QString &raw) {
        if (auto *v = currentView()) v->load(normalizeUrl(raw));
    }

    bool m_appMode = false;
    QWebEngineProfile *m_profile = nullptr;
    QTabWidget *m_tabs = nullptr;
    QLineEdit *m_urlBar = nullptr;
    QLabel *m_tlsBadge = nullptr;
};

int main(int argc, char *argv[]) {
    QApplication app(argc, argv);
    app.setApplicationName("aero-browser");

    bool appMode = false;
    QString url = QString::fromLatin1(HOME_URL);
    for (int i = 1; i < argc; ++i) {
        QString arg = QString::fromUtf8(argv[i]);
        if (arg == "--app") {
            appMode = true;
        } else if (!arg.startsWith('-')) {
            url = arg;
        }
    }

    AeroBrowserWindow win(url, appMode);
    win.show();
    return app.exec();
}
