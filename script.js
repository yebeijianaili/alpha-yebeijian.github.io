// 币安Alpha积分15天滚动制计算器
class BinanceAlphaRollingCalculator {
    constructor() {
        this.chart = null;
        this.scoreData = {}; // 存储日期和积分的映射
        this.dateList = []; // 存储15天的日期列表
        this.predictionTimeout = null; // 用于延迟计算的定时器
        this.storageKey = 'binance_alpha_calculator_data'; // 本地存储键
        this.usersKey = 'binance_alpha_users'; // 用户列表存储键
        this.currentUser = 'default'; // 当前用户
        this.lastUpdateDate = null; // 记录上次更新日期
        this.predictionResults = []; // 存储多次预测结果
        this.currentPredictionIndex = 0; // 当前显示的预测结果索引
        
        // 初始化用户系统
        this.initializeUsers();
        
        // 加载保存的数据
        this.loadData();
        
        // 检查是否需要自动更新日期范围
        this.checkAndUpdateDateRange();
        
        // 在DOM加载后初始化输入框值
        setTimeout(() => {
            this.initializeInputValues();
        }, 0);
        
        this.initializeEventListeners();
        this.initializeDefaultDate();
        this.updateCalculation();
        
        
        // 初始化时计算一次预测
        setTimeout(() => {
            this.calculatePrediction();
        }, 100);
        
        // 设置自动保存
        this.setupAutoSave();
    }

    // 初始化默认日期为今天
    initializeDefaultDate() {
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 15); // 往前推15天，不包括今天
        
        this.generateDateTable();
    }

    // 格式化日期为YYYY-MM-DD
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 生成15天的日期列表
    generateDateList(startDateStr) {
        const dates = [];
        const startDate = new Date(startDateStr);
        
        for (let i = 0; i < 15; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            dates.push(this.formatDate(currentDate));
        }
        
        return dates;
    }

    initializeEventListeners() {
        // 监听刷分设置变化
        const dailyScoreInput = document.getElementById('dailyScore');
        if (dailyScoreInput) {
            dailyScoreInput.addEventListener('input', () => {
                // 不再清空手动填写的 raw，保留用户修改
                this.generateDateTable();
                this.generateFutureTable();
                this.calculatePrediction();
                this.saveData(); // 自动保存
            });
        }
        
        // 监听期望积分变化，自动重新计算预测
        const expectedScoreInput = document.getElementById('expectedScore');
        if (expectedScoreInput) {
            expectedScoreInput.addEventListener('input', () => {
                // 延迟计算，避免用户输入时频繁计算
                clearTimeout(this.predictionTimeout);
                this.predictionTimeout = setTimeout(() => {
                    this.calculatePrediction();
                    this.saveData(); // 自动保存
                }, 500);
            });
        }
    }

    // 生成日期表格
    generateDateTable() {
        const todayDate = new Date();
        const startDate = new Date(todayDate);
        startDate.setDate(todayDate.getDate() - 15); // 往前推15天
        const startDateStr = this.formatDate(startDate);

        this.dateList = this.generateDateList(startDateStr);
        const today = this.formatDate(new Date());
        
        // 计算前15天的累计积分（不包括今天）
        const dailyScore = parseFloat(document.getElementById('dailyScore').value) || 17;
        let fifteenDaySum = 0;
        this.dateList.forEach(dateStr => {
            const userRaw = this.scoreData[dateStr]?.raw;
            const raw = userRaw !== undefined ? userRaw : dailyScore;
            const claim = this.scoreData[dateStr]?.claim || 0;
            fifteenDaySum += raw - (15 * claim);
        });
        
        let tableHTML = `
            <table class="score-table">
                <thead>
                    <tr>
                        <th>日期</th>
                        <th>星期</th>
                        <th>原始积分</th>
                        <th>领取数量</th>
                        <th>记账积分</th>
                        <th>滚动窗口</th>
                    </tr>
                </thead>
                <tbody>
        `;

        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        
        // 添加前15天的记录
        this.dateList.forEach((dateStr, index) => {
            const date = new Date(dateStr);
            const weekday = weekdays[date.getDay()];
            
            // 优先使用默认刷分数目，但允许用户在方框中修改
            const dailyScore = parseFloat(document.getElementById('dailyScore').value) || 17;
            const userRawScore = this.scoreData[dateStr]?.raw;
            const rawScore = userRawScore !== undefined ? userRawScore : dailyScore;
            const claimCount = this.scoreData[dateStr]?.claim || 0;
            const accountingScore = rawScore - (15 * claimCount);
            
            // 计算滚动窗口累计：当天的前15天积分和（不包括当天）
            let rollingSum = 0;
            for (let i = Math.max(0, index - 14); i < index; i++) {
                const prevDateStr = this.dateList[i];
                if (prevDateStr) {
                    const userPrevRaw = this.scoreData[prevDateStr]?.raw;
                    const prevRaw = userPrevRaw !== undefined ? userPrevRaw : dailyScore;
                    const prevClaim = this.scoreData[prevDateStr]?.claim || 0;
                    rollingSum += prevRaw - (15 * prevClaim);
                }
            }

            tableHTML += `
                <tr>
                    <td class="date-cell">${dateStr}</td>
                    <td>周${weekday}</td>
                    <td>
                        <input type="number" class="score-input" 
                               value="${rawScore}" 
                               onchange="updateScoreData('${dateStr}', 'raw', this.value)"
                               step="1" min="0" placeholder="${dailyScore}">
                    </td>
                    <td>
                        <input type="number" class="score-input" 
                               value="${claimCount}" 
                               onchange="updateScoreData('${dateStr}', 'claim', this.value)"
                               step="1" min="0">
                    </td>
                    <td style="font-weight: bold; color: ${accountingScore >= 0 ? '#4CAF50' : '#f44336'}">
                        ${accountingScore}
                    </td>
                    <td style="font-weight: bold; color: #f0b90b;">
                        ${rollingSum}
                    </td>
                </tr>
            `;
        });

        // 添加今天的分界线，显示前15天累计
        tableHTML += `
            <tr style="background-color: #f0b90b; border-top: 2px solid #f7931a;">
                <td class="date-cell" style="font-weight: bold; color: #0b0e11;">${today} (今天)</td>
                <td style="font-weight: bold; color: #0b0e11;">周${weekdays[new Date(today).getDay()]}</td>
                <td colspan="2" style="text-align: center; font-weight: bold; color: #0b0e11;">
                    前15天累计: ${fifteenDaySum} 分
                </td>
                <td style="font-weight: bold; color: #0b0e11;">分界线</td>
                <td style="font-weight: bold; color: #0b0e11;">${fifteenDaySum}</td>
            </tr>
        `;

        tableHTML += `
                </tbody>
            </table>
        `;

        document.getElementById('scoreTable').innerHTML = tableHTML;
        this.generateFutureTable();
        this.updateStatistics();
    }

    // 生成未来15天预测表格
    generateFutureTable() {
        const dailyScore = parseFloat(document.getElementById('dailyScore').value) || 17;
        const today = new Date();
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        
        // 计算今天的滚动窗口（前15天积分和，不包括今天）
        let todayRollingSum = 0;
        this.dateList.forEach(dateStr => {
            if (this.scoreData[dateStr]) {
                const raw = this.scoreData[dateStr].raw || 0;
                const claim = this.scoreData[dateStr].claim || 0;
                todayRollingSum += raw - (15 * claim);
            }
        });
        
        let futureHTML = `
            <table class="score-table">
                <thead>
                    <tr>
                        <th>日期</th>
                        <th>星期</th>
                        <th>预测积分</th>
                        <th>预计领取</th>
                        <th>记账积分</th>
                        <th>滚动窗口</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // 创建未来积分数组，用于滚动窗口计算
        // 优先使用用户在输入框中设置的值，没有则使用默认刷分数目
        const futureScores = [];
        for (let i = 0; i < 15; i++) {
            futureScores.push(dailyScore); // 默认每日固定积分，可被输入框覆盖
        }
        
        for (let i = 0; i < 15; i++) {
            const futureDate = new Date(today);
            futureDate.setDate(today.getDate() + i);
            const dateStr = this.formatDate(futureDate);
            const weekday = weekdays[futureDate.getDay()];
            
            // 优先使用默认刷分数目，但允许用户在方框中修改
            const userFutureScore = this.scoreData[dateStr]?.raw;
            const predictedScore = userFutureScore !== undefined ? userFutureScore : dailyScore;
            const predictedClaim = this.scoreData[dateStr]?.claim || 0;
            const accountingScore = predictedScore - (15 * predictedClaim);
            
            // 计算滚动窗口：基于昨天的新增积分、过期积分和领取扣分
            let rollingWindow = 0;
            
            if (i === 0) {
                // 第一天（今天）：使用历史前15天的积分统计
                this.dateList.forEach(histDateStr => {
                    const userHistRaw = this.scoreData[histDateStr]?.raw;
                    const histRaw = userHistRaw !== undefined ? userHistRaw : dailyScore;
                    const histClaim = this.scoreData[histDateStr]?.claim || 0;
                    rollingWindow += histRaw - (15 * histClaim);
                });
            } else {
                // 未来的天数：基于昨天的滚动窗口 + 昨天新增积分 - 过期积分 - 昨天领取扣分
                
                // 获取昨天的数据
                const yesterdayDate = new Date(today);
                yesterdayDate.setDate(today.getDate() + i - 1);
                const yesterdayDateStr = this.formatDate(yesterdayDate);
                
                // 昨天的新增积分
                const userYesterdayRaw = this.scoreData[yesterdayDateStr]?.raw;
                const yesterdayNewScore = userYesterdayRaw !== undefined ? userYesterdayRaw : dailyScore;
                
                // 昨天的领取扣分
                const yesterdayClaimCount = this.scoreData[yesterdayDateStr]?.claim || 0;
                const yesterdayDeduction = 15 * yesterdayClaimCount;
                
                // 计算过期积分（15天前的积分）
                let expiredScore = 0;
                const expiredDate = new Date(today);
                expiredDate.setDate(today.getDate() + i - 15);
                const expiredDateStr = this.formatDate(expiredDate);
                
                // 如果过期日期在历史范围内
                if (this.dateList.includes(expiredDateStr)) {
                    const userExpiredRaw = this.scoreData[expiredDateStr]?.raw;
                    const expiredRaw = userExpiredRaw !== undefined ? userExpiredRaw : dailyScore;
                    const expiredClaim = this.scoreData[expiredDateStr]?.claim || 0;
                    expiredScore = expiredRaw - (15 * expiredClaim);
                } else if (expiredDate >= new Date(today)) {
                    // 如果过期日期在未来范围内
                    const userExpiredRaw = this.scoreData[expiredDateStr]?.raw;
                    const expiredRaw = userExpiredRaw !== undefined ? userExpiredRaw : dailyScore;
                    const expiredClaim = this.scoreData[expiredDateStr]?.claim || 0;
                    expiredScore = expiredRaw - (15 * expiredClaim);
                }
                
                // 获取前一天的滚动窗口值
                // 这里需要递归计算或者从前一行获取
                // 为简化，我们重新计算当前窗口
                const windowStartDate = new Date(today);
                windowStartDate.setDate(today.getDate() + i - 15);
                const windowEndDate = new Date(today);
                windowEndDate.setDate(today.getDate() + i - 1);
                
                // 计算窗口内的所有积分
                for (let windowDay = new Date(windowStartDate); windowDay <= windowEndDate; windowDay.setDate(windowDay.getDate() + 1)) {
                    const windowDateStr = this.formatDate(windowDay);
                    
                    if (this.dateList.includes(windowDateStr)) {
                        // 历史数据
                        const userWindowRaw = this.scoreData[windowDateStr]?.raw;
                        const windowRaw = userWindowRaw !== undefined ? userWindowRaw : dailyScore;
                        const windowClaim = this.scoreData[windowDateStr]?.claim || 0;
                        rollingWindow += windowRaw - (15 * windowClaim);
                    } else if (windowDay >= today) {
                        // 未来数据
                        const userWindowRaw = this.scoreData[windowDateStr]?.raw;
                        const windowRaw = userWindowRaw !== undefined ? userWindowRaw : dailyScore;
                        const windowClaim = this.scoreData[windowDateStr]?.claim || 0;
                        rollingWindow += windowRaw - (15 * windowClaim);
                    }
                }
            }
            
            const isFirstDay = i === 0;
            const rowStyle = isFirstDay ? 'background-color: #474d57;' : '';

            futureHTML += `
                <tr style="${rowStyle}">
                    <td class="date-cell">${dateStr}${isFirstDay ? ' (今天开始)' : ''}</td>
                    <td>周${weekday}</td>
                    <td>
                        <input type="number" class="score-input" 
                               value="${predictedScore}" 
                               onchange="updateFutureScoreData('${dateStr}', 'raw', this.value)"
                               step="1" min="0" placeholder="${dailyScore}">
                    </td>
                    <td>
                        <input type="number" class="score-input" 
                               value="${predictedClaim}" 
                               onchange="updateFutureScoreData('${dateStr}', 'claim', this.value)"
                               step="1" min="0">
                    </td>
                    <td style="font-weight: bold; color: ${accountingScore >= 0 ? '#4CAF50' : '#f44336'};">
                        ${accountingScore}
                    </td>
                    <td style="font-weight: bold; color: #02c076;">
                        ${rollingWindow}
                    </td>
                </tr>
            `;
        }

        futureHTML += `
                </tbody>
            </table>
        `;

        document.getElementById('futureTable').innerHTML = futureHTML;
        
    }

    // 更新未来积分数据
    updateFutureScoreData(dateStr, type, value) {
        if (!this.scoreData[dateStr]) {
            this.scoreData[dateStr] = {};
        }
        
        this.scoreData[dateStr][type] = parseInt(value) || 0;
        this.generateFutureTable(); // 重新生成表格以更新计算
        this.saveData(); // 自动保存数据
    }

    // 更新积分数据
    updateScoreData(dateStr, type, value) {
        if (!this.scoreData[dateStr]) {
            this.scoreData[dateStr] = {};
        }
        
        this.scoreData[dateStr][type] = parseInt(value) || 0;
        this.generateDateTable(); // 重新生成表格以更新计算
        this.updateCalculation();
        this.saveData(); // 自动保存数据
    }

    // 更新统计数据
    updateStatistics() {
        const dailyScore = parseFloat(document.getElementById('dailyScore').value) || 17;
        let totalSum = 0;
        let validDays = 0;

        // 计算前15天的总积分
        this.dateList.forEach((dateStr) => {
            const userRaw = this.scoreData[dateStr]?.raw;
            const raw = userRaw !== undefined ? userRaw : dailyScore;
            const claim = this.scoreData[dateStr]?.claim || 0;
            const accounting = raw - (15 * claim);
            
            totalSum += accounting;
            validDays++;
        });

        const average = validDays > 0 ? totalSum / validDays : 0;

    }

    // 计算回分预测
    calculatePrediction() {
        // 添加按钮点击效果
        const btn = document.getElementById('calculateBtn');
        if (btn) {
            btn.classList.add('clicked');
            setTimeout(() => btn.classList.remove('clicked'), 600);
        }
        
        // 显示加载状态
        const btnText = document.getElementById('btnText');
        const btnLoader = document.getElementById('btnLoader');
        const resultDiv = document.getElementById('predictionResult');
        
        if (btn && btnText && btnLoader) {
            btn.disabled = true;
            btn.style.opacity = '0.7';
            btnText.style.display = 'none';
            btnLoader.style.display = 'inline';
            resultDiv.innerHTML = `
                <div style="color: #f0b90b; font-size: 1rem; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.2rem;">⏳</span>
                    <span>计算中...</span>
                </div>
            `;
        }
        
        // 模拟计算延迟，提供更好的用户体验
        setTimeout(() => {
            this.performPredictionCalculation();
            
            // 恢复按钮状态
            if (btn && btnText && btnLoader) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btnText.style.display = 'inline';
                btnLoader.style.display = 'none';
            }
        }, 800);
    }
    
    // 执行预测计算
    performPredictionCalculation() {
        const expectedScore = parseFloat(document.getElementById('expectedScore').value) || 200;
        const dailyScore = parseFloat(document.getElementById('dailyScore').value) || 17;
        
        if (!expectedScore || expectedScore <= 0) {
            document.getElementById('predictionResult').innerHTML = `
                <div style="color: #f44336; font-size: 1rem; font-weight: 500; display: flex; align-items: center; gap: 8px; animation: shake 0.5s ease-in-out;">
                    <span style="font-size: 1.2rem;">❌</span>
                    <span>请输入期望回分数量</span>
                </div>
            `;
            return;
        }
        
        // 计算今天的滚动窗口（前15天积分）
        let currentWindow = 0;
        this.dateList.forEach(dateStr => {
            const userRaw = this.scoreData[dateStr]?.raw;
            const raw = userRaw !== undefined ? userRaw : dailyScore;
            const claim = this.scoreData[dateStr]?.claim || 0;
            currentWindow += raw - (15 * claim);
        });
        
        // 如果当前已经达到目标
        if (currentWindow >= expectedScore) {
            document.getElementById('predictionResult').innerHTML = `
                <div style="color: #02c076; font-size: 1rem; font-weight: 600; text-align: center;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 1.4rem;">✅</span>
                        <span>当前已达到目标</span>
                    </div>
                    <div style="font-size: 0.9rem; color: #848e9c;">
                        当前积分: <span style="color: #02c076; font-weight: 700;">${currentWindow}</span> 分
                    </div>
                </div>
            `;
            return;
        }
        
        // 逐天计算未来的滚动窗口，找到所有达到目标的日期
        const today = new Date();
        const foundDates = [];
        
        // 最多计算100天（防止无限循环）
        for (let dayOffset = 1; dayOffset <= 100; dayOffset++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() + dayOffset);
            
            // 计算这一天的滚动窗口
            let rollingWindow = 0;
            
            // 计算窗口起始日期（15天前）
            const windowStart = new Date(checkDate);
            windowStart.setDate(checkDate.getDate() - 15);
            
            // 遍历15天窗口
            for (let i = 0; i < 15; i++) {
                const windowDate = new Date(windowStart);
                windowDate.setDate(windowStart.getDate() + i);
                const windowDateStr = this.formatDate(windowDate);
                
                let dayScore = 0;
                let dayClaim = 0;
                
                // 如果是历史日期（在dateList中）
                if (this.dateList.includes(windowDateStr)) {
                    const userRaw = this.scoreData[windowDateStr]?.raw;
                    dayScore = userRaw !== undefined ? userRaw : dailyScore;
                    dayClaim = this.scoreData[windowDateStr]?.claim || 0;
                } 
                // 如果是未来日期（今天及以后）
                else if (windowDate >= today) {
                    const userFutureRaw = this.scoreData[windowDateStr]?.raw;
                    dayScore = userFutureRaw !== undefined ? userFutureRaw : dailyScore;
                    dayClaim = this.scoreData[windowDateStr]?.claim || 0;
                }
                // 如果是更早的历史日期，使用默认值
                else {
                    dayScore = dailyScore;
                    dayClaim = 0;
                }
                
                rollingWindow += dayScore - (15 * dayClaim);
            }
            
            // 检查是否达到目标
            if (rollingWindow >= expectedScore) {
                foundDates.push({
                    date: this.formatDate(checkDate),
                    score: rollingWindow,
                    dayOffset: dayOffset
                });
                
                // 继续查找更多的日期，不限制次数
            }
        }
        
        // 保存找到的日期供后续使用
        this.predictionResults = foundDates;
        this.currentPredictionIndex = 0;
        
        if (foundDates.length > 0) {
            this.displayPredictionResult(0);
        } else {
            document.getElementById('predictionResult').innerHTML = `
                <div style="color: #f44336; font-size: 1rem; font-weight: 600; text-align: center; animation: shake 0.5s ease-in-out;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 1.4rem;">⚠️</span>
                        <span>无法达到目标</span>
                    </div>
                    <div style="font-size: 0.85rem; color: #848e9c;">
                        100天内无法达到目标<br>
                        <span style="color: #f0b90b;">建议增加每日积分或减少领取频率</span>
                    </div>
                </div>
            `;
        }
    }

    // 解析历史数据
    parseHistoryData(historyString) {
        if (!historyString || historyString.trim() === '') {
            return [];
        }
        
        try {
            return historyString.split(',')
                .map(s => parseFloat(s.trim()))
                .filter(n => !isNaN(n));
        } catch (e) {
            return [];
        }
    }

    // 计算今日记账积分
    calculateTodayAccountingScore(rawScore, claimCount) {
        // 今日记账积分 = 今日原始积分 − 15 × 今日领取数量
        return rawScore - (15 * claimCount);
    }

    // 计算资格窗口
    calculateQualificationWindow(historyData, currentDay) {
        // 今日资格窗口 = 从昨天起向前 14 天的记账积分之和
        // 历史不足15天时，按现有天数求和
        
        const availableDays = Math.min(currentDay - 1, 14);
        const windowData = historyData.slice(-availableDays);
        
        return windowData.reduce((sum, score) => sum + score, 0);
    }

    // 计算明日资格窗口
    calculateTomorrowWindow(todayWindow, todayAccountingScore, historyData, currentDay) {
        // 明天的资格窗口 = 今天的资格窗口 + 今天的记账积分 − 十五天前那一天的记账积分
        
        let tomorrowWindow = todayWindow + todayAccountingScore;
        
        // 如果历史数据足够15天，需要减去15天前的积分
        if (currentDay >= 15 && historyData.length >= 15) {
            const fifteenDaysAgo = historyData[historyData.length - 15];
            tomorrowWindow -= fifteenDaysAgo;
        }
        
        return tomorrowWindow;
    }

    // 判断领取资格
    checkEligibility(qualificationWindow, threshold) {
        return qualificationWindow >= threshold;
    }

    // 生成策略建议
    generateStrategy(rawScore, claimCount, qualificationWindow, threshold, todayAccountingScore, tomorrowWindow) {
        const suggestions = [];
        
        if (qualificationWindow < threshold) {
            suggestions.push('当前不具备领取资格，需要积累更多积分');
            
            const needed = threshold - qualificationWindow;
            suggestions.push(`还需要${needed}分才能达到领取阈值`);
            
            if (rawScore > 0) {
                const daysNeeded = Math.ceil(needed / rawScore);
                suggestions.push(`按当前原始积分速度，需要${daysNeeded}天达到阈值`);
            }
        } else {
            if (claimCount === 0) {
                suggestions.push('当前具备领取资格，可以考虑领取空投');
            } else {
                suggestions.push(`今日已领取${claimCount}个空投`);
                
                if (tomorrowWindow >= threshold) {
                    suggestions.push('明日仍将保持领取资格');
                } else {
                    suggestions.push('⚠️ 明日可能失去领取资格，请谨慎');
                }
            }
        }
        
        if (todayAccountingScore < 0) {
            suggestions.push(`今日记账积分为负(${todayAccountingScore})，将影响未来资格`);
        }
        
        // 计算最大可领取数量
        if (qualificationWindow >= threshold) {
            const maxClaim = Math.floor((qualificationWindow - threshold) / 15) + 1;
            if (maxClaim > claimCount) {
                suggestions.push(`理论上今日最多可领取${maxClaim}个空投`);
            }
        }
        
        return suggestions.length > 0 ? suggestions.join('<br>') : '保持当前策略';
    }

    // 显示预测结果
    displayPredictionResult(index) {
        if (!this.predictionResults || index >= this.predictionResults.length) {
            return;
        }
        
        const result = this.predictionResults[index];
        const expectedScore = parseFloat(document.getElementById('expectedScore').value) || 200;
        const targetDate = new Date(result.date);
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const weekday = weekdays[targetDate.getDay()];
        
        // 计算序号显示
        const ordinalText = index === 0 ? '首次' : `第${index + 1}次`;
        
        // 控制导航按钮显示（始终展示箭头，但在没有更多结果时禁用）
        const navigationDiv = document.getElementById('predictionNavigation');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        if (navigationDiv && prevBtn && nextBtn) {
            navigationDiv.style.display = 'flex';
            const hasMultiple = this.predictionResults && this.predictionResults.length > 1;
            const prevDisabled = !hasMultiple || index === 0;
            const nextDisabled = !hasMultiple || index === this.predictionResults.length - 1;

            prevBtn.disabled = prevDisabled;
            nextBtn.disabled = nextDisabled;
            prevBtn.style.opacity = prevDisabled ? '0.5' : '1';
            nextBtn.style.opacity = nextDisabled ? '0.5' : '1';
            prevBtn.style.cursor = prevDisabled ? 'not-allowed' : 'pointer';
            nextBtn.style.cursor = nextDisabled ? 'not-allowed' : 'pointer';
        }
        
        document.getElementById('predictionResult').innerHTML = `
            <div style="color: #02c076; font-size: 1rem; font-weight: 600; text-align: center;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px;">
                    <span style="font-size: 1.4rem;">🎉</span>
                    <span>${ordinalText}达到目标</span>
                </div>
                <div style="font-size: 0.95rem; color: #eaecef; margin-bottom: 8px;">
                    <strong>${result.date}</strong> (周${weekday})
                </div>
                <div style="font-size: 0.85rem; color: #848e9c; margin-bottom: 10px;">
                    预计积分: <span style="color: #02c076; font-weight: 700;">${result.score}</span> 分<br>
                    <span style="color: #f0b90b;">超出 ${result.score - expectedScore} 分</span>
                </div>
                ${index > 0 ? `
                    <div style="margin-top: 8px; font-size: 0.75rem; color: #848e9c;">
                        距离首次达到: ${result.dayOffset - this.predictionResults[0].dayOffset} 天
                    </div>
                ` : ''}
            </div>
        `;
        
        this.currentPredictionIndex = index;
    }
    
    // 显示下一个预测结果
    showNextPrediction() {
        if (this.currentPredictionIndex < this.predictionResults.length - 1) {
            this.displayPredictionResult(this.currentPredictionIndex + 1);
        }
    }
    
    // 显示上一个预测结果
    showPrevPrediction() {
        if (this.currentPredictionIndex > 0) {
            this.displayPredictionResult(this.currentPredictionIndex - 1);
        }
    }
    
    
    
    // 显示某天的详情
    showDayDetails(dateStr) {
        const hasData = this.scoreData[dateStr];
        const dailyScore = parseFloat(document.getElementById('dailyScore')?.value) || 17;
        
        if (hasData) {
            const raw = hasData.raw !== undefined ? hasData.raw : dailyScore;
            const claim = hasData.claim || 0;
            const accounting = raw - (15 * claim);
            
            this.showMessage(`${dateStr}\n原始积分: ${raw}\n领取数量: ${claim}\n记账积分: ${accounting}`, accounting >= 0 ? 'success' : 'error');
        } else {
            this.showMessage(`${dateStr}\n暂无数据记录`, 'info');
        }
    }

    // 更新计算结果
    updateCalculation() {
        // 这个方法现在主要用于触发统计更新
        this.updateStatistics();
        // 自动保存数据
        this.saveData();
    }

    // 初始化用户系统
    initializeUsers() {
        // 加载用户列表
        const users = this.getUsers();
        if (!users.includes('default')) {
            users.unshift('default');
            this.saveUsers(users);
        }
        
        // 读取最近一次使用的用户
        try {
            const lastUser = localStorage.getItem('binance_alpha_current_user');
            if (lastUser && users.includes(lastUser)) {
                this.currentUser = lastUser;
            }
        } catch (e) {
            // ignore
        }

        // 更新用户选择器
        this.updateUserSelector();
        
        // 设置用户切换事件监听器
        const userSelect = document.getElementById('userSelect');
        if (userSelect) {
            userSelect.addEventListener('change', (e) => {
                this.switchUser(e.target.value);
            });
        }
    }
    
    // 获取用户列表
    getUsers() {
        try {
            const users = localStorage.getItem(this.usersKey);
            return users ? JSON.parse(users) : ['default'];
        } catch (error) {
            console.error('Error loading users:', error);
            return ['default'];
        }
    }
    
    // 保存用户列表
    saveUsers(users) {
        try {
            localStorage.setItem(this.usersKey, JSON.stringify(users));
        } catch (error) {
            console.error('Error saving users:', error);
        }
    }
    
    // 更新用户选择器
    updateUserSelector() {
        const userSelect = document.getElementById('userSelect');
        if (!userSelect) return;
        
        const users = this.getUsers();
        userSelect.innerHTML = '';
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user;
            option.textContent = user === 'default' ? '默认用户' : user;
            if (user === this.currentUser) {
                option.selected = true;
            }
            userSelect.appendChild(option);
        });
    }

	// 更新管理对话框中的用户列表
	updateManageUserList() {
		const container = document.getElementById('manageUserList');
		if (!container) return;
		const users = this.getUsers();
		container.innerHTML = '';
		users.forEach(user => {
			const row = document.createElement('div');
			row.style.display = 'flex';
			row.style.alignItems = 'center';
			row.style.justifyContent = 'space-between';
			row.style.padding = '10px 12px';
			row.style.border = '1px solid #474d57';
			row.style.borderRadius = '8px';
			row.style.background = '#1e2329';
			
			const left = document.createElement('div');
			left.style.display = 'flex';
			left.style.alignItems = 'center';
			left.style.gap = '10px';
			left.innerHTML = `<span style="color:#eaecef;font-weight:600;">${user === 'default' ? '默认用户' : user}</span>${user === this.currentUser ? '<span style="color:#f0b90b;font-size:12px;background:rgba(240,185,11,.12);padding:2px 6px;border-radius:4px;margin-left:6px;">当前</span>' : ''}`;
			
			const right = document.createElement('div');
			right.style.display = 'flex';
			right.style.gap = '8px';
			
			const renameBtn = document.createElement('button');
			renameBtn.textContent = '重命名';
			renameBtn.style.cssText = 'background:transparent;border:1px solid #474d57;color:#eaecef;border-radius:6px;height:30px;padding:0 10px;cursor:pointer;font-weight:600;';
			renameBtn.onmouseover = function(){ this.style.borderColor = '#f0b90b'; this.style.color = '#f0b90b'; };
			renameBtn.onmouseout = function(){ this.style.borderColor = '#474d57'; this.style.color = '#eaecef'; };
			renameBtn.onclick = () => { window.renameUserPrompt(user); };
			
			const delBtn = document.createElement('button');
			delBtn.textContent = '删除';
			delBtn.style.cssText = 'background:#3b4250;border:1px solid #5e6673;color:#eaecef;border-radius:6px;height:30px;padding:0 10px;cursor:pointer;font-weight:600;';
			delBtn.onmouseover = function(){ this.style.background = '#5e6673'; };
			delBtn.onmouseout = function(){ this.style.background = '#3b4250'; };
			delBtn.onclick = () => { window.deleteUserConfirm(user); };
			
			if (user === 'default') {
				delBtn.disabled = true;
				delBtn.style.opacity = '0.6';
			}
			
			right.appendChild(renameBtn);
			right.appendChild(delBtn);
			row.appendChild(left);
			row.appendChild(right);
			container.appendChild(row);
		});
	}

	// 重命名用户（包含数据迁移）
	renameUser(oldName, newName) {
		if (!newName || newName === oldName) return false;
		if (newName === 'default') {
			this.showMessage('不能使用"default"作为用户名', 'error');
			return false;
		}
		const users = this.getUsers();
		if (!users.includes(oldName)) return false;
		if (users.includes(newName)) {
			this.showMessage('用户名已存在', 'error');
			return false;
		}
		// 迁移本地存储数据
		const oldKey = `${this.storageKey}_${oldName}`;
		const newKey = `${this.storageKey}_${newName}`;
		const oldData = localStorage.getItem(oldKey);
		if (oldData !== null) {
			localStorage.setItem(newKey, oldData);
			localStorage.removeItem(oldKey);
		}
		// 更新用户列表
		const idx = users.indexOf(oldName);
		users[idx] = newName;
		this.saveUsers(users);
		// 当前用户也要更新
		if (this.currentUser === oldName) {
			this.currentUser = newName;
            try { localStorage.setItem('binance_alpha_current_user', this.currentUser); } catch(e) {}
		}
		this.updateUserSelector();
		this.updateManageUserList();
		this.showMessage('重命名成功', 'success');
		return true;
	}

	// 删除用户
	deleteUser(userName) {
		if (userName === 'default') {
			this.showMessage('默认用户不可删除', 'error');
			return false;
		}
		const users = this.getUsers();
		if (!users.includes(userName)) return false;
		// 删除本地存储数据
		const key = `${this.storageKey}_${userName}`;
		localStorage.removeItem(key);
		// 更新用户列表
		const newUsers = users.filter(u => u !== userName);
		this.saveUsers(newUsers);
		// 如果删除的是当前用户，切回默认
		if (this.currentUser === userName) {
			this.switchUser('default');
		}
		this.updateUserSelector();
		this.updateManageUserList();
		this.showMessage('用户已删除', 'success');
		return true;
	}
    
    // 切换用户
    switchUser(userName) {
        if (userName === this.currentUser) return;
        
        // 保存当前用户数据
        this.saveData();
        
        // 切换到新用户
        this.currentUser = userName;
        try { localStorage.setItem('binance_alpha_current_user', this.currentUser); } catch(e) {}
        
        // 重置数据并加载新用户数据
        this.scoreData = {};
        this.predictionResults = [];
        this.currentPredictionIndex = 0;
        
        // 加载新用户数据
        this.loadData();
        this.checkAndUpdateDateRange();
        this.initializeInputValues(); // 强制写入该用户的daily/expected
        this.generateDateTable();
        this.generateFutureTable();
        this.calculatePrediction();
        
        // 显示切换消息
        this.showMessage(`已切换到用户: ${userName === 'default' ? '默认用户' : userName}`, 'info');
    }

    // 加载保存的数据
    loadData() {
        try {
            const userKey = `${this.storageKey}_${this.currentUser}`;
            const savedData = localStorage.getItem(userKey);
            if (savedData) {
                const data = JSON.parse(savedData);
                this.scoreData = data.scoreData || {};
                this.lastUpdateDate = data.lastUpdateDate;
                
                // 直接设置保存的值，避免闪烁
                this.savedDailyScore = data.dailyScore || 17;
                this.savedExpectedScore = data.expectedScore || 200;
                
                console.log(`用户 ${this.currentUser} 数据加载成功`);
            } else {
                // 如果没有保存的数据，使用默认值
                this.savedDailyScore = 17;
                this.savedExpectedScore = 200;
            }
        } catch (error) {
            console.error('数据加载失败:', error);
            // 出错时使用默认值
            this.savedDailyScore = 17;
            this.savedExpectedScore = 200;
        }
    }

    // 初始化输入框的值（始终使用当前用户的已保存值覆盖）
    initializeInputValues() {
        const dailyScoreInput = document.getElementById('dailyScore');
        if (dailyScoreInput) {
            dailyScoreInput.value = this.savedDailyScore || 17;
        }
        
        const expectedScoreInput = document.getElementById('expectedScore');
        if (expectedScoreInput) {
            expectedScoreInput.value = this.savedExpectedScore || 200;
        }
    }

    // 保存数据到本地存储
    saveData() {
        try {
            const data = {
                scoreData: this.scoreData,
                lastUpdateDate: this.formatDate(new Date()),
                dailyScore: document.getElementById('dailyScore')?.value || 17,
                expectedScore: document.getElementById('expectedScore')?.value || 200,
                timestamp: Date.now()
            };
            
            const userKey = `${this.storageKey}_${this.currentUser}`;
            localStorage.setItem(userKey, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('数据保存失败:', error);
            return false;
        }
    }

    // 检查并自动更新日期范围
    checkAndUpdateDateRange() {
        const today = this.formatDate(new Date());
        
        // 如果是新的一天，自动更新日期范围
        if (this.lastUpdateDate && this.lastUpdateDate !== today) {
            console.log(`检测到日期变更: ${this.lastUpdateDate} -> ${today}`);
            this.autoUpdateDateRange();
        }
        
        this.lastUpdateDate = today;
    }

    // 自动更新日期范围
    autoUpdateDateRange() {
        const today = new Date();
        const newStartDate = new Date(today);
        newStartDate.setDate(today.getDate() - 15);
        
        // 日期已自动更新
        
        // 清理过期的未来数据（超过今天15天的数据）
        const cutoffDate = new Date(today);
        cutoffDate.setDate(today.getDate() + 15);
        const cutoffDateStr = this.formatDate(cutoffDate);
        
        Object.keys(this.scoreData).forEach(dateStr => {
            if (dateStr > cutoffDateStr) {
                delete this.scoreData[dateStr];
            }
        });
        
        // 自动填充未来数据
        this.autoFillFutureData();
        
        console.log('日期范围已自动更新');
    }

    // 自动填充未来数据
    autoFillFutureData() {
        const today = new Date();
        const dailyScore = parseFloat(document.getElementById('dailyScore')?.value) || 17;
        
        // 为未来15天自动填充默认数据（如果没有用户自定义数据）
        for (let i = 0; i < 15; i++) {
            const futureDate = new Date(today);
            futureDate.setDate(today.getDate() + i);
            const dateStr = this.formatDate(futureDate);
            
            // 只有当该日期没有用户数据时才自动填充
            if (!this.scoreData[dateStr] || !this.scoreData[dateStr].raw) {
                if (!this.scoreData[dateStr]) {
                    this.scoreData[dateStr] = {};
                }
                // 不设置raw值，让系统使用默认的dailyScore
                // this.scoreData[dateStr].raw = dailyScore;
            }
        }
    }

    // 设置自动保存
    setupAutoSave() {
        // 监听所有输入变化，自动保存
        setInterval(() => {
            this.saveData();
        }, 30000); // 每30秒自动保存一次
        
        // 页面关闭时保存
        window.addEventListener('beforeunload', () => {
            this.saveData();
        });
    }

    // 重置所有数据
    resetAllData() {
        if (confirm('确定要重置所有数据吗？这将清空所有积分记录和设置，恢复到默认状态。')) {
            try {
                // 仅清空当前用户的数据
                const userKey = `${this.storageKey}_${this.currentUser}`;
                localStorage.removeItem(userKey);
                
                // 重置内存数据
                this.scoreData = {};
                this.lastUpdateDate = null;
                
                // 重置输入框
                document.getElementById('dailyScore').value = 17;
                document.getElementById('expectedScore').value = 200;
                
                // 重新初始化
                this.initializeDefaultDate();
                this.updateCalculation();
                
                // 显示成功消息
                this.showMessage('数据重置成功！', 'success');
                
                console.log('数据重置完成');
                return true;
            } catch (error) {
                console.error('数据重置失败:', error);
                this.showMessage('数据重置失败！', 'error');
                return false;
            }
        }
        return false;
    }

    // 显示消息提示
    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            background: ${type === 'success' ? '#02c076' : type === 'error' ? '#f44336' : '#f0b90b'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;
        messageDiv.textContent = message;
        
        document.body.appendChild(messageDiv);
        
        // 3秒后自动移除
        setTimeout(() => {
            messageDiv.style.opacity = '0';
            messageDiv.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 300);
        }, 3000);
    }
}

// 全局变量存储计算器实例
let calculator;


// 全局函数：更新积分数据
function updateScoreData(dateStr, type, value) {
    if (calculator) {
        calculator.updateScoreData(dateStr, type, value);
    }
}

// 全局函数：计算预测
function calculatePrediction() {
    if (calculator) {
        calculator.calculatePrediction();
    }
}

// 全局函数：更新未来积分数据
function updateFutureScoreData(dateStr, type, value) {
    if (calculator) {
        calculator.updateFutureScoreData(dateStr, type, value);
    }
}

// 全局函数：显示下一个预测结果
function showNextPrediction() {
    if (calculator) {
        calculator.showNextPrediction();
    }
}


// 全局函数：显示上一个预测结果
function showPrevPrediction() {
    if (calculator) {
        calculator.showPrevPrediction();
    }
}



// 全局函数：重置数据
function resetData() {
    if (calculator) {
        // 添加按钮点击效果
        const btn = document.getElementById('resetBtn');
        if (btn) {
            btn.style.transform = 'scale(0.9) rotate(-15deg)';
            setTimeout(() => {
                btn.style.transform = 'scale(1) rotate(0deg)';
            }, 200);
        }
        calculator.resetAllData();
    }
}

// 显示下一个预测结果
function showNextPrediction() {
    if (calculator && calculator.predictionResults.length > 0) {
        calculator.currentPredictionIndex = Math.min(calculator.currentPredictionIndex + 1, calculator.predictionResults.length - 1);
        calculator.displayPredictionResult(calculator.currentPredictionIndex);
    }
}

// 显示上一个预测结果
function showPrevPrediction() {
    if (calculator && calculator.predictionResults.length > 0) {
        calculator.currentPredictionIndex = Math.max(calculator.currentPredictionIndex - 1, 0);
        calculator.displayPredictionResult(calculator.currentPredictionIndex);
    }
}

// 显示添加用户对话框
function showAddUserDialog() {
    const dialog = document.getElementById('addUserDialog');
    const input = document.getElementById('newUserName');
    if (dialog && input) {
        dialog.style.display = 'flex';
        input.value = '';
        input.focus();
    }
}

// 隐藏添加用户对话框
function hideAddUserDialog() {
    const dialog = document.getElementById('addUserDialog');
    if (dialog) {
        dialog.style.display = 'none';
    }
}

// 添加新用户
function addNewUser() {
    const input = document.getElementById('newUserName');
    if (!input) return;
    
    const userName = input.value.trim();
    if (!userName) {
        alert('请输入用户名称');
        return;
    }
    
    if (userName === 'default') {
        alert('不能使用"default"作为用户名');
        return;
    }
    
    if (calculator) {
        const users = calculator.getUsers();
        if (users.includes(userName)) {
            alert('用户名已存在，请使用其他名称');
            return;
        }
        
        // 添加新用户到列表
        users.push(userName);
        calculator.saveUsers(users);
        
        // 更新用户选择器
        calculator.updateUserSelector();
        
        // 切换到新用户
        calculator.switchUser(userName);
        
        // 隐藏对话框
        hideAddUserDialog();
        
        calculator.showMessage(`用户 "${userName}" 添加成功！`, 'success');
    }
}

// 键盘事件处理
document.addEventListener('keydown', function(e) {
    const dialog = document.getElementById('addUserDialog');
    if (dialog && dialog.style.display === 'flex') {
        if (e.key === 'Enter') {
            addNewUser();
        } else if (e.key === 'Escape') {
            hideAddUserDialog();
        }
    }
});

// 页面加载完成后初始化计算器
document.addEventListener('DOMContentLoaded', function() {
    calculator = new BinanceAlphaRollingCalculator();
    // 兼容使用 window.calculator 的调用方
    window.calculator = calculator;
    
    // 添加工具提示
    const tooltips = {
        'todayRawScore': '今日通过各种活动获得的原始积分，可以是任意非负数值',
        'todayClaimCount': '今日计划领取的空投数量，每个空投扣除15分',
        'threshold': '领取空投所需的最低资格窗口积分'
    };
    
    Object.keys(tooltips).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.title = tooltips[id];
        }
    });
});

// 打开管理对话框
function showManageUserDialog() {
	const dialog = document.getElementById('manageUserDialog');
	if (dialog) {
		dialog.style.display = 'flex';
		if (window.calculator) {
			window.calculator.updateManageUserList();
		}
	}
}

// 关闭管理对话框
function hideManageUserDialog() {
	const dialog = document.getElementById('manageUserDialog');
	if (dialog) {
		dialog.style.display = 'none';
	}
}

// 提示重命名
function renameUserPrompt(oldName) {
	const newName = prompt('请输入新的用户名：', oldName);
	if (newName && window.calculator) {
		window.calculator.renameUser(oldName, newName.trim());
	}
}

// 删除确认
function deleteUserConfirm(userName) {
	if (confirm(`确认删除用户 "${userName}" 吗？该用户的本地数据将被清除。`)) {
		if (window.calculator) {
			window.calculator.deleteUser(userName);
		}
	}
}