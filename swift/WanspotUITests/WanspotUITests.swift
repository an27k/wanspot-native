import XCTest

@MainActor
final class WanspotUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testAuthenticationGuestEntryAndAllRootTabs() {
        let app = launch(scenario: "authentication")

        XCTAssertTrue(element("authentication.screen", in: app).waitForExistence(timeout: 8))
        XCTAssertTrue(app.textFields["メールアドレス"].exists)
        XCTAssertTrue(app.secureTextFields["パスワード"].exists)
        XCTAssertTrue(app.buttons["Appleで登録"].exists)

        app.buttons["すでにアカウントをお持ちの方"].tap()
        XCTAssertTrue(
            app.buttons["Appleでログイン"].waitForExistence(timeout: 3)
        )

        element("authentication.continueAsGuest", in: app).tap()
        XCTAssertTrue(element("root.tabs", in: app).waitForExistence(timeout: 8))

        for title in ["検索", "まとめ", "カレンダー", "マイページ"] {
            XCTAssertTrue(tab(title, in: app).exists, "\(title)タブが見つかりません")
        }

        tab("まとめ", in: app).tap()
        XCTAssertTrue(element("articles.screen", in: app).waitForExistence(timeout: 5))
        XCTAssertTrue(element("wanspot.brandHeader", in: app).exists)
        XCTAssertFalse(app.staticTexts["ワンスポまとめ"].exists)

        tab("カレンダー", in: app).tap()
        XCTAssertTrue(element("calendar.screen", in: app).waitForExistence(timeout: 5))
        XCTAssertTrue(element("wanspot.brandHeader", in: app).exists)

        tab("マイページ", in: app).tap()
        XCTAssertTrue(element("mypage.screen", in: app).waitForExistence(timeout: 5))
        XCTAssertTrue(element("wanspot.brandHeader", in: app).exists)
        XCTAssertFalse(app.staticTexts["マイページ"].exists)

        tab("検索", in: app).tap()
        XCTAssertTrue(
            app.textFields["地名・駅名・スポット名"]
                .waitForExistence(timeout: 5)
        )
    }

    func testTypedSpotContentAndProtectedMyPageRoutes() {
        var app = launch(
            scenario: "guest-location-unavailable",
            deepLink: "wanspot://spots/place_ui-test-place"
        )
        XCTAssertTrue(element("spotDetail.screen", in: app).waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["UIテストカフェ"].waitForExistence(timeout: 5))
        XCTAssertTrue(element("spotDetail.instagram", in: app).exists)
        XCTAssertTrue(element("spotDetail.aiLoginRequired", in: app).exists)
        XCTAssertFalse(app.staticTexts["愛犬と落ち着いて過ごせるカフェです。"].exists)

        let relatedArticle = element(
            "spotDetail.relatedArticle.ui-test-article",
            in: app
        )
        scrollToEnd(revealing: relatedArticle, in: app)
        XCTAssertTrue(relatedArticle.waitForExistence(timeout: 5))
        XCTAssertTrue(relatedArticle.isHittable)
        relatedArticle.tap()
        XCTAssertTrue(
            element("articleDetail.screen", in: app)
                .waitForExistence(timeout: 5)
        )
        app.navigationBars.buttons.firstMatch.tap()
        XCTAssertTrue(
            element("spotDetail.screen", in: app)
                .waitForExistence(timeout: 5)
        )

        app.buttons["いいねする"].tap()
        let authenticationPrompt = element("authentication.prompt", in: app)
        XCTAssertTrue(authenticationPrompt.waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["いいねを保存するには"].exists)
        XCTAssertFalse(element("authentication.screen", in: app).exists)
        app.buttons["今はしない"].tap()
        XCTAssertTrue(authenticationPrompt.waitForNonExistence(timeout: 3))

        app.buttons["行った記録を保存する"].tap()
        XCTAssertTrue(authenticationPrompt.waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["「行った」を記録するには"].exists)
        XCTAssertFalse(element("authentication.screen", in: app).exists)
        authenticationPrompt.buttons["ログイン・新規登録"].tap()
        XCTAssertTrue(
            element("authentication.screen", in: app)
                .waitForExistence(timeout: 5)
        )
        app.terminate()

        app = launch(
            scenario: "guest-location-unavailable",
            deepLink: "wanspot://articles/ui-test-article"
        )
        XCTAssertTrue(element("articleDetail.screen", in: app).waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["UIテスト記事"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["記事をシェア"].exists)
        app.terminate()

        app = launch(
            scenario: "guest-location-unavailable",
            deepLink: "wanspot://events/ui-test-event"
        )
        XCTAssertTrue(element("calendarDetail.screen", in: app).waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["UIテストイベント"].waitForExistence(timeout: 5))
        let eventArticle = element(
            "calendarDetail.relatedArticle.ui-test-article",
            in: app
        )
        scrollToEnd(revealing: eventArticle, in: app)
        XCTAssertTrue(eventArticle.waitForExistence(timeout: 5))
        XCTAssertTrue(eventArticle.isHittable)
        eventArticle.tap()
        XCTAssertTrue(
            element("articleDetail.screen", in: app)
                .waitForExistence(timeout: 5)
        )
        app.navigationBars.buttons.firstMatch.tap()
        XCTAssertTrue(
            element("calendarDetail.screen", in: app)
                .waitForExistence(timeout: 5)
        )
        app.terminate()

        app = launch(
            scenario: "guest-location-unavailable",
            deepLink: "wanspot://mypage/walk-forecast"
        )
        XCTAssertTrue(element("authentication.screen", in: app).waitForExistence(timeout: 8))
    }

    func testGuestAuthenticationGateFromMyPage() {
        let app = launch(scenario: "guest-location-unavailable")

        tab("マイページ", in: app).tap()
        XCTAssertTrue(element("mypage.screen", in: app).waitForExistence(timeout: 5))
        element("mypage.authenticate", in: app).tap()

        XCTAssertTrue(element("authentication.screen", in: app).waitForExistence(timeout: 5))
    }

    func testLocationDeniedAndUnavailableStates() {
        var app = launch(scenario: "guest-location-denied")
        XCTAssertTrue(element("search.locationDenied", in: app).waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["位置情報を利用できません"].exists)
        app.terminate()

        app = launch(scenario: "guest-location-unavailable")
        XCTAssertTrue(
            element("search.locationUnavailable", in: app)
                .waitForExistence(timeout: 8)
        )
        XCTAssertTrue(app.buttons["位置情報を再取得"].exists)
    }

    func testDarkModeLaunchKeepsAccessibleRoot() {
        let app = launch(
            scenario: "guest-location-unavailable",
            darkMode: true
        )

        XCTAssertTrue(element("root.tabs", in: app).waitForExistence(timeout: 8))
        XCTAssertTrue(app.textFields["地名・駅名・スポット名"].exists)
        XCTAssertTrue(app.buttons["位置情報を再取得"].exists)

        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Wanspot dark mode"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }

    func testCaptureAppStorePreviewScreens() throws {
        let environment = ProcessInfo.processInfo.environment
        let credentialsPath =
            environment["WANSPOT_PREVIEW_CREDENTIALS_FILE"]
                ?? "/tmp/wanspot-swift-preview-account.json"
        let previewSpotPath =
            environment["WANSPOT_PREVIEW_SPOT_FILE"]
                ?? "/Users/atsu/Developer/wanspot-app-store-previews/"
                + "preview-spot.json"
        let outputPath =
            environment["WANSPOT_PREVIEW_OUTPUT_DIR"]
                ?? "/Users/atsu/Developer/wanspot-app-store-previews/"
                + "Wanspot-previews-final/captures/swift"
        guard
            FileManager.default.fileExists(atPath: credentialsPath),
            FileManager.default.fileExists(atPath: previewSpotPath)
        else {
            throw XCTSkip(
                "App Storeプレビュー用の認証情報または固定スポットが未指定です。"
            )
        }
        let credentials = try JSONDecoder().decode(
            PreviewCredentials.self,
            from: Data(contentsOf: URL(fileURLWithPath: credentialsPath))
        )
        let previewSpot = try JSONDecoder().decode(
            PreviewSpot.self,
            from: Data(contentsOf: URL(fileURLWithPath: previewSpotPath))
        )
        let outputDirectory = URL(
            fileURLWithPath: outputPath,
            isDirectory: true
        )
        try FileManager.default.createDirectory(
            at: outputDirectory,
            withIntermediateDirectories: true
        )

        let app = XCUIApplication()
        app.launchArguments = [
            "-wanspot.mapSearchTutorialSeen.v1",
            "YES",
            "-onboarding_complete_v1",
            "YES",
            "-theme_preference_v1",
            "light",
            "-AppleLanguages",
            "(ja)",
            "-AppleLocale",
            "ja_JP",
            "-AppleInterfaceStyle",
            "Light",
        ]
        app.launchEnvironment = [
            "WANSPOT_PREVIEW_LAT": String(previewSpot.latitude),
            "WANSPOT_PREVIEW_LNG": String(previewSpot.longitude),
        ]
        app.launch()

        let rootTabs = element("root.tabs", in: app)
        if rootTabs.waitForExistence(timeout: 15) {
            tab("マイページ", in: app).tap()
            XCTAssertTrue(
                element("mypage.screen", in: app)
                    .waitForExistence(timeout: 8)
            )
            let authenticate = element("mypage.authenticate", in: app)
            if authenticate.waitForExistence(timeout: 3) {
                authenticate.tap()
            }
        }

        let authentication = element("authentication.screen", in: app)
        if authentication.waitForExistence(timeout: 5) {
            let switchToLogin =
                app.buttons["すでにアカウントをお持ちの方"]
            if switchToLogin.waitForExistence(timeout: 2) {
                switchToLogin.tap()
            }

            let emailField = app.textFields["メールアドレス"]
            XCTAssertTrue(emailField.waitForExistence(timeout: 5))
            emailField.tap()
            emailField.typeText(credentials.email)

            let passwordField = app.secureTextFields["パスワード"]
            passwordField.tap()
            passwordField.typeText(credentials.password)
            app.buttons["ログイン"].tap()
            XCTAssertTrue(rootTabs.waitForExistence(timeout: 20))
        }

        tab("検索", in: app).tap()
        XCTAssertTrue(
            app.textFields["地名・駅名・スポット名"]
                .waitForExistence(timeout: 10)
        )
        let anySpotCard = app.descendants(matching: .any).matching(
            NSPredicate(format: "identifier BEGINSWITH %@", "search.spotCard.")
        ).firstMatch
        XCTAssertTrue(anySpotCard.waitForExistence(timeout: 20))
        let previewSpotAnnotation = app.otherElements.matching(
            NSPredicate(format: "label == %@", previewSpot.name)
        ).firstMatch
        XCTAssertTrue(previewSpotAnnotation.waitForExistence(timeout: 10))
        previewSpotAnnotation.tap()
        let previewSpotCard = element(
            "search.spotCard.\(previewSpot.placeId)",
            in: app
        )
        XCTAssertTrue(previewSpotCard.waitForExistence(timeout: 10))
        sleep(4)
        try capture(
            app,
            named: "01-search-map.png",
            in: outputDirectory
        )

        app.buttons["条件"].tap()
        XCTAssertTrue(app.buttons["店内OK"].waitForExistence(timeout: 5))
        try capture(
            app,
            named: "02-search-filters.png",
            in: outputDirectory
        )
        app.coordinate(
            withNormalizedOffset: CGVector(dx: 0.95, dy: 0.52)
        ).tap()

        previewSpotCard.tap()
        let spotDetail = element("spotDetail.screen", in: app)
        XCTAssertTrue(spotDetail.waitForExistence(timeout: 15))
        XCTAssertTrue(
            spotDetail.staticTexts[previewSpot.name]
                .waitForExistence(timeout: 10)
        )
        try capture(
            app,
            named: "03-spot-detail.png",
            in: outputDirectory
        )

        // チャットは本番の /api/chat を叩くので、詰まっても
        // 以降の撮影を止めないよう内部で握りつぶす
        captureChatIfPossible(app, in: outputDirectory)

        let firstRating = element("spotDetail.userRating.1", in: app)
        if !firstRating.waitForExistence(timeout: 2) {
            let recordVisit = app.buttons["行った記録を保存する"]
            XCTAssertTrue(recordVisit.waitForExistence(timeout: 3))
            recordVisit.tap()
        }
        XCTAssertTrue(firstRating.waitForExistence(timeout: 8))
        XCTAssertTrue(firstRating.isHittable)
        XCTAssertTrue(
            element("spotDetail.userMemo", in: app)
                .waitForExistence(timeout: 3)
        )

        let aiReviewTitle = app.staticTexts["ワンスポ AIレビュー"]
        for _ in 0 ..< 5 where !aiReviewTitle.isHittable {
            app.swipeUp()
        }
        let aiSummary = spotDetail.descendants(matching: .any)
            .matching(identifier: "spotDetail.aiSummary")
            .firstMatch
        XCTAssertTrue(aiSummary.waitForExistence(timeout: 45))
        XCTAssertGreaterThanOrEqual(
            aiSummary.label.count,
            previewSpot.minimumSummaryLength
        )
        XCTAssertTrue(
            spotDetail.staticTexts[previewSpot.requiredKeyword]
                .waitForExistence(timeout: 5)
        )
        for forbiddenText in previewSpot.forbiddenTextFragments {
            XCTAssertEqual(
                spotDetail.staticTexts.matching(
                    NSPredicate(
                        format: "label CONTAINS %@",
                        forbiddenText
                    )
                ).count,
                0,
                "未生成・保留中のAIレビュー文言が表示されています: \(forbiddenText)"
            )
        }
        try capture(
            app,
            named: "04-ai-review.png",
            in: outputDirectory
        )
        app.navigationBars.buttons.firstMatch.tap()

        tab("まとめ", in: app).tap()
        XCTAssertTrue(
            element("articles.screen", in: app)
                .waitForExistence(timeout: 10)
        )
        sleep(7)
        try capture(
            app,
            named: "05-articles.png",
            in: outputDirectory
        )
        let eventGenre = element("articles.genre.イベント", in: app)
        let dogRunGenre = element("articles.genre.ドッグラン", in: app)
        XCTAssertTrue(eventGenre.waitForExistence(timeout: 5))
        XCTAssertTrue(dogRunGenre.waitForExistence(timeout: 5))
        eventGenre.tap()
        XCTAssertTrue(eventGenre.isSelected)
        dogRunGenre.tap()
        XCTAssertTrue(dogRunGenre.isSelected)
        XCTAssertTrue(element("articles.screen", in: app).exists)
        XCTAssertFalse(element("articleDetail.screen", in: app).exists)

        tab("カレンダー", in: app).tap()
        XCTAssertTrue(
            element("calendar.screen", in: app)
                .waitForExistence(timeout: 10)
        )
        sleep(7)
        try capture(
            app,
            named: "06-calendar.png",
            in: outputDirectory
        )

        tab("マイページ", in: app).tap()
        XCTAssertTrue(
            element("mypage.screen", in: app)
                .waitForExistence(timeout: 10)
        )
        let forecast = element("mypage.walkForecast", in: app)
        for _ in 0 ..< 4 where !forecast.exists {
            app.swipeUp()
        }
        XCTAssertTrue(forecast.waitForExistence(timeout: 8))
        forecast.tap()
        XCTAssertTrue(
            app.navigationBars["お散歩予報"]
                .waitForExistence(timeout: 8)
        )
        sleep(7)
        try capture(
            app,
            named: "07-walk-forecast.png",
            in: outputDirectory
        )

        app.navigationBars.buttons.firstMatch.tap()
        let likes = element("mypage.likes", in: app)
        for _ in 0 ..< 4 where !likes.exists {
            app.swipeUp()
        }
        XCTAssertTrue(likes.waitForExistence(timeout: 8))
        likes.tap()
        XCTAssertTrue(
            app.navigationBars["いいね"].waitForExistence(timeout: 8)
        )
        sleep(10)
        try capture(
            app,
            named: "08-liked-spots.png",
            in: outputDirectory
        )
    }

    func testCaptureSupplementalPreviewScreens() throws {
        let credentialsPath = "/tmp/wanspot-swift-preview-account.json"
        guard FileManager.default.fileExists(atPath: credentialsPath) else {
            throw XCTSkip("App Storeプレビュー用の認証情報が未指定です。")
        }
        let credentials = try JSONDecoder().decode(
            PreviewCredentials.self,
            from: Data(contentsOf: URL(fileURLWithPath: credentialsPath))
        )
        let outputDirectory = URL(
            fileURLWithPath: "/Users/atsu/Developer/"
                + "wanspot-app-store-previews/Wanspot-previews-final/"
                + "captures/swift",
            isDirectory: true
        )

        let app = XCUIApplication()
        app.launchArguments = [
            "-wanspot.mapSearchTutorialSeen.v1",
            "YES",
            "-onboarding_complete_v1",
            "YES",
            "-theme_preference_v1",
            "light",
            "-AppleLanguages",
            "(ja)",
            "-AppleLocale",
            "ja_JP",
            "-AppleInterfaceStyle",
            "Light",
        ]
        app.launch()

        let rootTabs = element("root.tabs", in: app)
        if rootTabs.waitForExistence(timeout: 15) {
            tab("マイページ", in: app).tap()
            let authenticate = element("mypage.authenticate", in: app)
            if authenticate.waitForExistence(timeout: 4) {
                authenticate.tap()
            }
        }
        let authentication = element("authentication.screen", in: app)
        if authentication.waitForExistence(timeout: 5) {
            let switchToLogin =
                app.buttons["すでにアカウントをお持ちの方"]
            if switchToLogin.waitForExistence(timeout: 2) {
                switchToLogin.tap()
            }
            let emailField = app.textFields["メールアドレス"]
            XCTAssertTrue(emailField.waitForExistence(timeout: 5))
            emailField.tap()
            emailField.typeText(credentials.email)
            let passwordField = app.secureTextFields["パスワード"]
            passwordField.tap()
            passwordField.typeText(credentials.password)
            app.buttons["ログイン"].tap()
            XCTAssertTrue(rootTabs.waitForExistence(timeout: 20))
        }

        tab("カレンダー", in: app).tap()
        XCTAssertTrue(
            element("calendar.screen", in: app)
                .waitForExistence(timeout: 10)
        )
        sleep(6)
        let eventDay = app.buttons.matching(
            NSPredicate(format: "label CONTAINS %@", "イベント")
        ).firstMatch
        XCTAssertTrue(eventDay.waitForExistence(timeout: 8))
        eventDay.tap()
        sleep(4)
        try capture(
            app,
            named: "06-calendar-events.png",
            in: outputDirectory
        )

        tab("マイページ", in: app).tap()
        XCTAssertTrue(
            element("mypage.screen", in: app)
                .waitForExistence(timeout: 10)
        )
        sleep(4)
        try capture(
            app,
            named: "08-mypage.png",
            in: outputDirectory
        )
    }

    private func launch(
        scenario: String,
        deepLink: String? = nil,
        darkMode: Bool = false
    ) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "--ui-testing",
            "-wanspot.mapSearchTutorialSeen.v1",
            "YES",
            "-AppleLanguages",
            "(ja)",
            "-AppleLocale",
            "ja_JP",
        ]
        if darkMode {
            app.launchArguments += ["-AppleInterfaceStyle", "Dark"]
        }
        app.launchEnvironment = [
            "WANSPOT_UI_TESTING": "1",
            "WANSPOT_UI_TEST_SCENARIO": scenario,
            "WANSPOT_UI_TEST_RUN_ID": UUID().uuidString,
        ]
        if let deepLink {
            app.launchEnvironment["WANSPOT_UI_TEST_DEEP_LINK"] = deepLink
        }
        app.launch()
        return app
    }

    private func element(
        _ identifier: String,
        in app: XCUIApplication
    ) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(identifier: identifier)
            .firstMatch
    }

    /// 末尾の要素をタップできる位置まで送る。
    /// isHittable はスポット詳細の下部固定バー（safeAreaInset）に
    /// 中心が隠れていても true を返し、そのままタップすると
    /// 「いいねする」「行った記録を保存する」側に当たってしまう。
    /// そのため位置が動かなくなる＝これ以上スクロールできない所まで送る
    private func scrollToEnd(
        revealing element: XCUIElement,
        in app: XCUIApplication,
        maximumSwipes: Int = 8
    ) {
        var previousFrame: CGRect?
        for _ in 0 ..< maximumSwipes {
            app.swipeUp()
            guard element.exists else {
                previousFrame = nil
                continue
            }
            let frame = element.frame
            if frame == previousFrame {
                return
            }
            previousFrame = frame
        }
    }

    private func tab(
        _ title: String,
        in app: XCUIApplication
    ) -> XCUIElement {
        let tabBarButton = app.tabBars.buttons[title]
        if tabBarButton.waitForExistence(timeout: 2) {
            return tabBarButton
        }
        return app.buttons[title]
    }

    /// スポット詳細から右下のチャットFABを開き、サジェスト質問を1つ送って
    /// 回答（出るならカードも）が揃ったところを 09-chat.png として撮る。
    /// 本番の /api/chat を叩くため、相談枠切れ・混雑・回線で撮れないことがある。
    /// その場合でも後続の撮影を続けたいので XCTAssert では落とさず、
    /// 撮らずにシートを閉じて戻る。
    private func captureChatIfPossible(
        _ app: XCUIApplication,
        in directory: URL
    ) {
        let fab = element("chat.fab", in: app)
        guard fab.waitForExistence(timeout: 8), fab.isHittable else { return }
        fab.tap()

        let sheet = element("chat.sheet", in: app)
        guard sheet.waitForExistence(timeout: 10) else { return }
        defer { dismissChatSheet(app) }

        // 起動をまたいだ会話が復元されるとサジェストチップが出ないので、
        // 復元を待ってから流す（サジェストは messages が空のときだけ出る）
        sleep(4)
        clearChatConversationIfNeeded(app)

        guard let chip = chatSuggestionChip(in: app) else { return }
        chip.tap()

        guard waitForChatAnswer(in: sheet, app: app) else { return }
        // 末尾までのスクロールアニメーションが落ち着くのを待つ
        sleep(3)
        try? capture(app, named: "09-chat.png", in: directory)
    }

    private func clearChatConversationIfNeeded(_ app: XCUIApplication) {
        let menu = element("chat.menu", in: app)
        guard menu.exists, menu.isEnabled else { return }
        menu.tap()
        let clear = element("chat.clearConversation", in: app)
        if clear.waitForExistence(timeout: 4) {
            clear.tap()
        } else {
            // メニューが開けなかったときは開いたままにしない
            app.coordinate(
                withNormalizedOffset: CGVector(dx: 0.5, dy: 0.06)
            ).tap()
        }
        sleep(1)
    }

    /// スポット詳細の文脈で出るチップを優先して選ぶ。
    /// 文言が変わっていてもシートの先頭チップで代替する
    private func chatSuggestionChip(
        in app: XCUIApplication
    ) -> XCUIElement? {
        for label in ["店内に入れる？", "大型犬でもOK？", "駐車場はある？"] {
            let button = app.buttons[label]
            if button.waitForExistence(timeout: 4), button.isHittable {
                return button
            }
        }
        let fallback = element("chat.suggestions", in: app)
            .buttons
            .firstMatch
        guard fallback.waitForExistence(timeout: 4), fallback.isHittable else {
            return nil
        }
        return fallback
    }

    /// ストリーミング完了を知らせる要素が無いので、
    /// カードが出るか本文が伸びきる（＝長さが変わらなくなる）まで待つ
    private func waitForChatAnswer(
        in sheet: XCUIElement,
        app: XCUIApplication,
        timeout: TimeInterval = 120
    ) -> Bool {
        let cards = app.descendants(matching: .any).matching(
            NSPredicate(
                format: "identifier == %@ OR identifier == %@"
                    + " OR identifier == %@",
                "chat.spotCard",
                "chat.articleCard",
                "chat.eventCard"
            )
        )
        let minimumAnswerLength = 60
        let deadline = Date().addingTimeInterval(timeout)
        var previousLength = 0
        var stableRounds = 0
        while Date() < deadline {
            sleep(3)
            if cards.count > 0 {
                return true
            }
            let length = longestChatTextLength(in: sheet)
            if length >= minimumAnswerLength, length == previousLength {
                stableRounds += 1
                if stableRounds >= 2 {
                    return true
                }
            } else {
                stableRounds = 0
            }
            previousLength = length
        }
        return cards.count > 0
            || longestChatTextLength(in: sheet) >= minimumAnswerLength
    }

    private func longestChatTextLength(in sheet: XCUIElement) -> Int {
        sheet.staticTexts
            .allElementsBoundByIndex
            .map { $0.label.count }
            .max() ?? 0
    }

    private func dismissChatSheet(_ app: XCUIApplication) {
        let sheet = element("chat.sheet", in: app)
        guard sheet.exists else { return }
        let close = app.buttons["閉じる"]
        if close.exists, close.isHittable {
            close.tap()
        } else {
            app.swipeDown(velocity: .fast)
        }
        _ = sheet.waitForNonExistence(timeout: 6)
    }

    private func capture(
        _ app: XCUIApplication,
        named name: String,
        in directory: URL
    ) throws {
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        try screenshot.pngRepresentation.write(
            to: directory.appendingPathComponent(name),
            options: .atomic
        )
    }
}

private struct PreviewCredentials: Decodable {
    let email: String
    let password: String
}

private struct PreviewSpot: Decodable {
    let placeId: String
    let routeId: String
    let name: String
    let latitude: Double
    let longitude: Double
    let minimumSummaryLength: Int
    let requiredKeyword: String
    let forbiddenTextFragments: [String]
}
