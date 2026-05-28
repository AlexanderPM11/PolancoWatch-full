import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

test.describe('PolancoWatch System - Suite E2E de Cobertura Completa', () => {

  test.beforeEach(async ({ page }) => {
    // Capturar logs y errores del navegador para depuración
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', error => console.error(`[Browser Page Error] ${error.message}`));

    // --- HELPER PARA CORS ---
    // Inyecta las cabeceras CORS requeridas por el navegador para llamadas cruzadas (Vite a API Mocked)
    const fulfillWithCors = async (route: any, status: number, body: any) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': 'http://localhost:5173',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        },
        body: typeof body === 'string' ? body : JSON.stringify(body)
      });
    };

    // --- INTERCEPTOR GLOBAL DE PREFLIGHTS OPTIONS (CORS) ---
    await page.route(
      (url) => url.pathname.includes('/api/') || url.pathname.includes('/metricshub') || url.pathname.includes('/backuphub'),
      async (route) => {
        if (route.request().method() === 'OPTIONS') {
          await route.fulfill({
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': 'http://localhost:5173',
              'Access-Control-Allow-Credentials': 'true',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            }
          });
        } else {
          await route.continue();
        }
      }
    );

    // --- MOCKS DE AUTENTICACIÓN (LOGIN & PERFIL) ---
    await page.route('**/api/auth/login', async (route) => {
      if (route.request().method() === 'POST') {
        const requestBody = JSON.parse(route.request().postData() || '{}');
        if (requestBody.username === 'admin' && requestBody.password === 'admin123') {
          await fulfillWithCors(route, 200, {
            username: 'admin',
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiZXhwIjoyNTAwMDAwMDAwfQ.signature'
          });
        } else {
          await fulfillWithCors(route, 401, { message: 'INVALID_CREDENTIALS_PROTOCOL: ACCESS_DENIED' });
        }
      }
    });

    await page.route('**/api/auth/profile', async (route) => {
      if (route.request().method() === 'POST') {
        const requestBody = JSON.parse(route.request().postData() || '{}');
        if (requestBody.currentPassword === 'admin123') {
          await fulfillWithCors(route, 200, {
            username: 'admin',
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiZXhwIjoyNTAwMDAwMDAwfQ.signature'
          });
        } else {
          await fulfillWithCors(route, 400, { message: 'SECURITY_ERROR: PASSPHRASE_VERIFICATION_FAILED' });
        }
      }
    });

    await page.route('**/api/auth/forgot-password', async (route) => {
      if (route.request().method() === 'POST') {
        const requestBody = JSON.parse(route.request().postData() || '{}');
        if (requestBody.email === 'admin@example.com') {
          await fulfillWithCors(route, 200, { success: true, message: 'THE RECOVERY LINK HAS BEEN DISPATCHED.' });
        } else if (requestBody.email === 'cooldown@example.com') {
          await fulfillWithCors(route, 200, { success: false, message: 'ERROR_COOLDOWN_ACTIVE' });
        } else {
          await fulfillWithCors(route, 200, { success: false, message: 'NOTIFICATIONS_NOT_CONFIGURED' });
        }
      }
    });

    await page.route('**/api/auth/reset-password', async (route) => {
      if (route.request().method() === 'POST') {
        const requestBody = JSON.parse(route.request().postData() || '{}');
        if (requestBody.token === 'valid-token' && requestBody.newPassword) {
          await fulfillWithCors(route, 200, { success: true, message: 'PASSWORD_SECURED_SUCCESSFULLY' });
        } else {
          await fulfillWithCors(route, 400, { message: 'RECOVERY_LINK_EXPIRED_OR_INVALID' });
        }
      }
    });

    // --- MOCK DE NEGOCIACIÓN DE WEB_SOCKETS DE SIGNALR (METRICS) ---
    await page.route('**/metricshub/negotiate*', async (route) => {
      await fulfillWithCors(route, 200, {
        negotiateVersion: 1,
        connectionId: 'mock-signalr-conn-id',
        connectionToken: 'mock-token',
        availableTransports: [
          { transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }
        ]
      });
    });

    // --- MOCK DE NEGOCIACIÓN DE WEB_SOCKETS DE SIGNALR (BACKUPS) ---
    await page.route('**/backuphub/negotiate*', async (route) => {
      await fulfillWithCors(route, 200, {
        negotiateVersion: 1,
        connectionId: 'mock-backup-conn-id',
        connectionToken: 'mock-backup-token',
        availableTransports: [
          { transport: 'WebSockets', transferFormats: ['Text', 'Binary'] }
        ]
      });
    });

    // --- MOCK DE ACCIONES Y MENSAJES DE SIGNALR (WEBSOCKET DE METRICAS) ---
    await page.routeWebSocket('**/metricshub*', (ws) => {
      let metricsInterval: any;
      ws.onMessage((message) => {
        if (typeof message === 'string' && message.includes('protocol')) {
          // Handshake de SignalR: responder con un objeto JSON vacío + delimitador 0x1e
          ws.send('{}\x1e');

          const sendMetrics = () => {
            const metricsPayload = {
              type: 1,
              target: 'ReceiveMetrics',
              arguments: [
                {
                  cpu: {
                    totalUsagePercentage: 35.8,
                    coreUsagePercentages: [22.4, 55.1, 10.9, 54.8],
                    loadAverage: [1.25, 1.5, 1.82]
                  },
                  memory: {
                    totalRamBytes: 17179869184, // 16GB
                    usedRamBytes: 8589934592,   // 8GB
                    freeRamBytes: 8589934592,
                    usagePercentage: 50.0
                  },
                  disks: [
                    { mountPoint: '/', totalSpaceBytes: 256203100000, usedSpaceBytes: 128101550000, usagePercentage: 50.0 }
                  ],
                  networks: [
                    { incomingBytesPerSecond: 1048576, outgoingBytesPerSecond: 524288 }
                  ],
                  systemInfo: {
                    hostname: 'PolancoWatch-Sentinel-Node',
                    osVersion: 'Ubuntu 24.04 LTS',
                    kernelVersion: '6.8.0-1008-aws',
                    uptime: '48:12:35'
                  },
                  topProcesses: [
                    { processId: 1001, name: 'dotnet', cpuUsagePercentage: 15.4, memoryUsageBytes: 322122547 },
                    { processId: 1002, name: 'node', cpuUsagePercentage: 8.2, memoryUsageBytes: 161061273 },
                    { processId: 1003, name: 'nginx', cpuUsagePercentage: 1.5, memoryUsageBytes: 53687091 },
                    { processId: 1004, name: 'postgres', cpuUsagePercentage: 4.8, memoryUsageBytes: 268435456 }
                  ],
                  dockerContainers: [
                    { containerId: 'c1', name: 'web-frontend', image: 'nginx:alpine', status: 'Up 2 hours', state: 'running', cpuPercentage: 0.5, memoryUsageBytes: 15728640, networkIO: '12MB / 4MB', blockIO: '0B / 0B' },
                    { containerId: 'c2', name: 'api-backend', image: 'polancowatch-backend:latest', status: 'Up 2 hours', state: 'running', cpuPercentage: 12.4, memoryUsageBytes: 268435456, networkIO: '45MB / 112MB', blockIO: '12MB / 54MB' }
                  ],
                  dockerStats: {
                    totalContainers: 2,
                    runningContainers: 2,
                    stoppedContainers: 0,
                    totalImages: 4
                  },
                  timestampUtc: new Date().toISOString()
                }
              ]
            };
            try {
              ws.send(JSON.stringify(metricsPayload) + '\x1e');
            } catch (e) {
              clearInterval(metricsInterval);
            }
          };

          // Enviar payload inicial de métricas vivas tras un pequeño delay
          setTimeout(sendMetrics, 150);

          // Iniciar intervalo periódico cada segundo
          metricsInterval = setInterval(sendMetrics, 1000);

          // Enviar alerta simulada en tiempo real tras otro intervalo
          setTimeout(() => {
            try {
              const alertPayload = {
                type: 1,
                target: 'ReceiveAlert',
                arguments: ['ALERT_WARNING: SYSTEM_CPU_LOAD exceeded threshold (90%) on Master Node']
              };
              ws.send(JSON.stringify(alertPayload) + '\x1e');
            } catch (e) {}
          }, 800);
        }
      });

      ws.onClose(() => {
        clearInterval(metricsInterval);
      });
    });

    // --- MOCK DE ACCIONES Y MENSAJES DE SIGNALR DE BACKUPS (WEBSOCKET DE BACKUPS) ---
    await page.routeWebSocket('**/backuphub*', (ws) => {
      ws.onMessage((message) => {
        if (typeof message === 'string' && message.includes('protocol')) {
          ws.send('{}\x1e');
          
          setTimeout(() => {
            try {
              const progressPayload = {
                type: 1,
                target: 'ReceiveBackupProgress',
                arguments: ['b1', 100, 'Backup completed and verified by mock controller.']
              };
              ws.send(JSON.stringify(progressPayload) + '\x1e');
            } catch (e) {}
          }, 500);
        }
      });
    });

    // --- MOCKS DE ALERTA Y SENTINEL RULES ---
    await page.route('**/api/alerts/rules', async (route) => {
      if (route.request().method() === 'GET') {
        await fulfillWithCors(route, 200, [
          { id: 1, metricType: 0, threshold: 80.0, cooldownSeconds: 300, isActive: true },
          { id: 2, metricType: 1, threshold: 90.0, cooldownSeconds: 600, isActive: false }
        ]);
      } else if (route.request().method() === 'POST') {
        const payload = JSON.parse(route.request().postData() || '{}');
        await fulfillWithCors(route, 200, payload);
      }
    });

    await page.route('**/api/alerts/history', async (route) => {
      if (route.request().method() === 'GET') {
        await fulfillWithCors(route, 200, [
          {
            id: 501,
            alertRuleId: 1,
            message: 'ALERT_WARNING: SYSTEM_CPU_LOAD exceeded threshold (80.0%) on Node',
            triggeredAt: new Date().toISOString()
          }
        ]);
      } else if (route.request().method() === 'DELETE') {
        await fulfillWithCors(route, 200, { success: true });
      }
    });

    await page.route('**/api/settings/notifications', async (route) => {
      if (route.request().method() === 'GET') {
        await fulfillWithCors(route, 200, {
          id: 1,
          telegramEnabled: true,
          telegramBotToken: '123456:ABC-Def',
          telegramChatId: '-987654321',
          emailEnabled: false,
          smtpHost: 'smtp.test.com',
          smtpPort: 587,
          smtpEnableSsl: true,
          smtpUser: 'alerts@test.com',
          smtpPass: 'password',
          fromEmail: 'alerts@test.com',
          toEmail: 'admin@test.com',
          telegramMessageTemplate: '⚠️ *{Metric}* Alert: *{Value}%*',
          emailMessageTemplate: 'HTML Template'
        });
      } else {
        await fulfillWithCors(route, 200, { success: true });
      }
    });

    // --- MOCKS DE MONITORES WEB (WEB MONITORS) ---
    await page.route('**/api/webmonitors', async (route) => {
      if (route.request().method() === 'GET') {
        await fulfillWithCors(route, 200, [
          {
            id: 1,
            name: 'Production Portal',
            url: 'https://apolanco.com',
            checkIntervalSeconds: 60,
            isActive: true,
            lastCheckTime: new Date().toISOString(),
            lastStatusUp: true,
            status: 0,
            lastLatencyMs: 25,
            slowThresholdMs: 1500,
            notifyOnSlow: true,
            notify: true
          }
        ]);
      } else if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        await fulfillWithCors(route, 200, {
          id: 2,
          ...body,
          isActive: true,
          lastStatusUp: true,
          status: 0,
          lastLatencyMs: 0
        });
      }
    });

    await page.route('**/api/webmonitors/1', async (route) => {
      await fulfillWithCors(route, 200, {
        id: 1,
        name: 'Production Portal',
        url: 'https://apolanco.com',
        checkIntervalSeconds: 60,
        isActive: true,
        lastCheckTime: new Date().toISOString(),
        lastStatusUp: true,
        status: 0,
        lastLatencyMs: 25,
        slowThresholdMs: 1500,
        notifyOnSlow: true,
        notify: true
      });
    });

    await page.route('**/api/webmonitors/1/history*', async (route) => {
      await fulfillWithCors(route, 200, [
        { id: 101, webMonitorId: 1, timestamp: new Date().toISOString(), isUp: true, latencyMs: 25, isSlow: false, statusCode: 200 },
        { id: 102, webMonitorId: 1, timestamp: new Date(Date.now() - 60000).toISOString(), isUp: true, latencyMs: 34, isSlow: false, statusCode: 200 }
      ]);
    });

    await page.route('**/api/webmonitors/1/stats*', async (route) => {
      await fulfillWithCors(route, 200, [
        {
          id: 1,
          webMonitorId: 1,
          date: new Date().toISOString().split('T')[0],
          upPercentage: 100,
          downPercentage: 0,
          slowPercentage: 0,
          averageLatencyMs: 29.5,
          totalChecks: 24,
          upCount: 24,
          downCount: 0,
          slowCount: 0
        }
      ]);
    });

    // --- MOCKS DE BACKUPS ---
    await page.route('**/api/backups', async (route) => {
      if (route.request().method() === 'GET') {
        await fulfillWithCors(route, 200, [
          {
            id: 'b1',
            name: 'DB_BACKUP_SYSTEM_01',
            type: 1, // Database
            format: 0, // Zip
            filePath: '/var/lib/backups/b1.zip',
            size: 1542031,
            createdAt: new Date().toISOString(),
            status: 2, // Completed
            cloudSyncStatus: 0
          }
        ]);
      } else if (route.request().method() === 'DELETE') {
        await fulfillWithCors(route, 200, { success: true });
      }
    });

    await page.route('**/api/backups/database*', async (route) => {
      await fulfillWithCors(route, 200, { success: true, message: 'Backup manually initialized successfully.' });
    });

    await page.route('**/api/backups/schedules', async (route) => {
      await fulfillWithCors(route, 200, []);
    });

    await page.route('**/api/backups/config/volumes', async (route) => {
      await fulfillWithCors(route, 200, [{ name: 'polancowatch_backups', path: '/var/lib/polancowatch' }]);
    });

    await page.route('**/api/backups/config/containers', async (route) => {
      await fulfillWithCors(route, 200, []);
    });

    await page.route('**/api/backups/drive/status', async (route) => {
      await fulfillWithCors(route, 200, { isAuthenticated: false });
    });

    // --- MOCK DE TERMINACIÓN DE PROCESOS (KILL) ---
    await page.route('**/api/metrics/processes/*/kill', async (route) => {
      await fulfillWithCors(route, 200, { success: true, message: 'Process terminated cleanly by Sentinel directive.' });
    });
  });

  // --- PRUEBA 1: INCIDENTE DE SEGURIDAD LOGIN ---
  test('Test 1: Rechazo de Autenticación por Credenciales Inválidas', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();

    await loginPage.login('intruder_node', 'wrong_security_phrase');
    await loginPage.expectErrorMessage('INVALID_CREDENTIALS_PROTOCOL');

    await page.screenshot({ path: 'screenshots/evidence-login-fail.png' });
  });

  // --- PRUEBA 2: INGRESO EXITOSO Y ANÁLISIS DE DASHBOARD VIVO ---
  test('Test 2: Acceso Exitoso, Métricas en Tiempo Real (SignalR) y Topology de CPU', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login('admin', 'admin123');

    await page.waitForURL('/');
    const dashboardPage = new DashboardPage(page);

    // Verificar encabezado
    await expect(dashboardPage.pageHeader).toBeVisible();
    await expect(dashboardPage.pageHeader).toContainText('System');

    // Verificar estado ONLINE de la conexión SignalR
    const connStatus = page.locator('span', { hasText: 'ONLINE' });
    await expect(connStatus).toBeVisible();

    // Verificar uptime e información del host mockeados
    const hostnameDisplay = page.getByRole('heading', { name: 'PolancoWatch-Sentinel-Node' });
    await expect(hostnameDisplay).toBeVisible();
    
    const uptimeDisplay = page.locator('p', { hasText: '48:12:35' });
    await expect(uptimeDisplay).toBeVisible();

    // Validar topología de núcleos (deben renderizarse las 4 CPU mockeadas)
    const threadsLabel = page.locator('span', { hasText: '4 Threads' });
    await expect(threadsLabel).toBeVisible();

    // Validar contenedores de Docker (evitando strict mode con selectors únicos)
    const containerFrontend = page.getByText('web-frontend').first();
    await expect(containerFrontend).toBeVisible();

    await page.screenshot({ path: 'screenshots/evidence-dashboard.png' });
  });

  // --- PRUEBA 3: GESTIÓN DE PROCESOS DEL SISTEMA ---
  test('Test 3: Inspección, Búsqueda y Terminación de Procesos (SIGKILL)', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login('admin', 'admin123');

    await page.waitForURL('/');
    const dashboardPage = new DashboardPage(page);

    // Navegar a la sección de procesos
    await dashboardPage.navigateToProcesses();
    await expect(dashboardPage.pageHeader).toContainText('Process');

    // Comprobar presencia de la tabla de procesos mockeados
    const processDotnet = page.getByText('dotnet').first();
    await expect(processDotnet).toBeVisible();

    const processNginx = page.getByText('nginx').first();
    await expect(processNginx).toBeVisible();

    // Probar el filtro/buscador
    const searchInput = page.getByPlaceholder('SEARCH PID_OR_NAME...');
    await searchInput.fill('nginx');
    
    // El proceso 'dotnet' debería desaparecer con el filtro 'nginx'
    await expect(processDotnet).not.toBeVisible();
    await expect(processNginx).toBeVisible();

    // Simular matar el proceso nginx
    const killButton = page.locator('tr').filter({ hasText: 'nginx' }).getByTitle('Kill Process').first();
    await killButton.click();

    // Verificar apertura del Modal de autorización de terminación
    const modalTitle = page.locator('h2', { hasText: 'Terminal Sequence Authorization' });
    await expect(modalTitle).toBeVisible();

    // Click en Confirmar Terminación
    const confirmButton = page.getByRole('button', { name: 'CONFIRM TERMINATION' });
    await confirmButton.click();

    // El modal debe cerrarse
    await expect(modalTitle).not.toBeVisible();

    await page.screenshot({ path: 'screenshots/evidence-processes.png' });
  });

  // --- PRUEBA 4: WEB MONITORS (LISTADO, ADICIÓN Y DETALLES) ---
  test('Test 4: Monitores Web - Creación de Nodo y Acceso a Gráficos de Latencia', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login('admin', 'admin123');

    await page.waitForURL('/');
    const dashboardPage = new DashboardPage(page);

    // Navegar a Web Monitors
    await dashboardPage.navigateToWebMonitors();
    await expect(dashboardPage.pageHeader).toContainText('Web');

    // Comprobar monitor inicial mockeado
    const monitorPortal = page.locator('span', { hasText: 'Production Portal' }).first();
    await expect(monitorPortal).toBeVisible();

    // Crear un nuevo monitor
    const newMonitorBtn = page.getByRole('button', { name: /New Monitor/i });
    await newMonitorBtn.click();

    const modalTitle = page.locator('h2', { hasText: 'Add Monitor' });
    await expect(modalTitle).toBeVisible();

    // Rellenar formulario
    await page.getByPlaceholder('e.g. Production API').fill('E2E Monitor Node');
    await page.getByPlaceholder('https://api.myapp.com/health').fill('https://test-node.com/health');
    await page.locator('input[type="number"]').first().fill('5');
    await page.getByRole('button', { name: 'Create Monitor' }).click();

    // Modal se cierra
    await expect(modalTitle).not.toBeVisible();

    // Navegar a detalles de 'Production Portal'
    const viewDetailsLink = page.locator('div').filter({ hasText: 'Production Portal' }).locator('a[title="Ver Detalles"]').first();
    await viewDetailsLink.click();

    // Verificar que estemos en la página de detalles
    await page.waitForURL(/\/web-monitors\/1/);
    const detailTitle = page.locator('h1', { hasText: 'Production Portal' }).first();
    await expect(detailTitle).toBeVisible();

    // Comprobar que cargó la latencia actual (25ms)
    const latencyCard = page.locator('span', { hasText: '25ms' }).first();
    await expect(latencyCard).toBeVisible();

    await page.screenshot({ path: 'screenshots/evidence-web-monitor-details.png' });
  });

  // --- PRUEBA 5: BÓVEDA DE BACKUPS (POLANCOVAULT) ---
  test('Test 5: Bóveda de Backups e Inicialización Manual de Resguardo', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login('admin', 'admin123');

    await page.waitForURL('/');
    const dashboardPage = new DashboardPage(page);

    // Navegar a Backups
    await dashboardPage.navigateToBackups();
    await expect(dashboardPage.pageHeader).toContainText('Vault');

    // Comprobar backup inicial
    const backupItem = page.getByText('DB_BACKUP_SYSTEM_01').first();
    await expect(backupItem).toBeVisible();

    // Verificar panel de Google Drive desonectado
    const driveStatusText = page.locator('p', { hasText: /Not Connected/i });
    await expect(driveStatusText).toBeVisible();

    // Generar un backup inmediato
    const immediateBackupBtn = page.getByRole('button', { name: /Immediate Backup/i });
    await immediateBackupBtn.click();

    const modalTitle = page.locator('h2', { hasText: 'PolancoVault Injection' });
    await expect(modalTitle).toBeVisible();

    // Poner nombre al backup
    await page.getByPlaceholder('System will generate alias...').fill('DB_E2E_MANUAL_VAULT');
    await page.getByRole('button', { name: 'Initiate Operation' }).click();

    // Modal se cierra
    await expect(modalTitle).not.toBeVisible();

    await page.screenshot({ path: 'screenshots/evidence-backups.png' });
  });

  // --- PRUEBA 6: ALERT ENGINE (HISTORIAL Y PROTOCOLOS) ---
  test('Test 6: Sentinel Rules e Historial de Incidentes', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login('admin', 'admin123');

    await page.waitForURL('/');
    const dashboardPage = new DashboardPage(page);

    // Navegar a Alerts
    await dashboardPage.navigateToAlerts();
    await expect(dashboardPage.pageHeader).toContainText('Alert');

    // Verificar lista de reglas
    const ruleCpu = page.getByText('CPU_LOAD').first();
    await expect(ruleCpu).toBeVisible();

    // Verificar incidente en log
    const incidentLog = page.locator('p', { hasText: /ALERT_WARNING/i }).first();
    await expect(incidentLog).toBeVisible();

    // Cambiar a la pestaña de notificaciones
    await page.getByRole('button', { name: 'Notifications' }).click();
    
    // Verificar que campos de Telegram cargaron con mock
    const tokenInput = page.locator('input[type="password"]').first();
    await expect(tokenInput).toHaveValue('123456:ABC-Def');

    await page.screenshot({ path: 'screenshots/evidence-alerts.png' });
  });

  // --- PRUEBA 7: PERFIL DEL USUARIO Y LOGOUT ---
  test('Test 7: Actualización de Credenciales y Cierre Seguro de Sesión', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login('admin', 'admin123');

    await page.waitForURL('/');
    const dashboardPage = new DashboardPage(page);

    // Navegar a Profile
    await dashboardPage.navigateToProfile();
    await expect(dashboardPage.pageHeader).toContainText('Profile');

    // Rellenar formulario de actualización de clave
    await page.getByPlaceholder('LEAVE BLANK TO KEEP').fill('SecurityOverhaul1!');
    await page.getByPlaceholder('REPEAT NEW PASSPHRASE').fill('SecurityOverhaul1!');
    await page.getByPlaceholder('ENTER CURRENT PASSPHRASE TO AUTHORIZE').fill('admin123');

    // Enviar formulario
    await page.getByRole('button', { name: 'COMMIT_CHANGES' }).click();

    // Validar mensaje de éxito (con selector tolerante)
    const successMsg = page.getByText('Identity parameters updated successfully.').first();
    await expect(successMsg).toBeVisible();

    await page.screenshot({ path: 'screenshots/evidence-profile.png' });

    // Cerrar sesión
    await dashboardPage.terminateSession();
    await expect(page).toHaveURL('/login');

    await page.screenshot({ path: 'screenshots/evidence-session-terminated.png' });
  });

  // --- PRUEBA 8: RECUPERACIÓN Y RE-DEFINICIÓN DE CLAVE (FORGOT & RESET PASSWORD) ---
  test('Test 8: Recuperación de Contraseña y Restablecimiento de Credencial de Seguridad', async ({ page }) => {
    // 1. Ir a la pantalla de Login y hacer click en el botón de recuperación
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    // Validar mensaje de error si no se ingresa usuario al clickear Forgotten_Security_Key?
    await page.getByRole('button', { name: 'Forgotten_Security_Key?' }).click();
    const handleErr = page.getByText('IDENTITY_HANDLE_REQUIRED');
    await expect(handleErr).toBeVisible();

    // Redirigir directamente a la página pública de forgot-password
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');

    // 2. Intentar con un correo que active Cooldown
    const emailInput = page.getByPlaceholder('ADMIN@EXAMPLE.COM');
    await emailInput.fill('cooldown@example.com');
    await page.getByRole('button', { name: 'DISPATCH_RECOVERY_LINK' }).click();
    const cooldownMsg = page.getByText('SECURITY_PROTOCOL_COOLDOWN');
    await expect(cooldownMsg).toBeVisible();
    await page.screenshot({ path: 'screenshots/evidence-forgot-password-cooldown.png' });

    // 3. Intentar con un correo válido
    await emailInput.fill('admin@example.com');
    await page.getByRole('button', { name: 'DISPATCH_RECOVERY_LINK' }).click();
    const successMsg = page.getByText('THE RECOVERY LINK HAS BEEN DISPATCHED');
    await expect(successMsg).toBeVisible();
    await page.screenshot({ path: 'screenshots/evidence-forgot-password-success.png' });

    // 4. Ir a la página de Reset con token válido
    await page.goto('/reset-password?token=valid-token');
    await page.waitForLoadState('networkidle');

    // Llenar contraseñas
    const newPassInput = page.locator('input[type="password"]').first();
    const confirmPassInput = page.locator('input[type="password"]').nth(1);
    await newPassInput.fill('NewSecureVal!123');
    await confirmPassInput.fill('NewSecureVal!123');
    await page.getByRole('button', { name: 'SECURE_NEW_PASSWORD' }).click();

    // Confirmar mensaje de éxito
    const resetSuccessMsg = page.getByText('PASSWORD_SECURED_SUCCESSFULLY');
    await expect(resetSuccessMsg).toBeVisible();
    await page.screenshot({ path: 'screenshots/evidence-reset-password.png' });

    // Debe redirigir a Login en unos segundos
    await page.waitForURL('/login', { timeout: 5000 });
  });

  // --- PRUEBA 9: EXPLORACIÓN DE DOCUMENTACIÓN DE ARQUITECTURA Y SUPABASE ---
  test('Test 9: Navegación de Pestañas de Documentación del Sistema', async ({ page }) => {
    // Autenticar primero
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.login('admin', 'admin123');
    await page.waitForURL('/');
    
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.navigateToDocumentation();
    await expect(dashboardPage.pageHeader).toContainText('Platform Architecture');

    // Cambiar a la pestaña de Seguridad y verificar
    await page.getByRole('button', { name: 'Security' }).click();
    const securityHeading = page.locator('h2', { hasText: 'Security & Privacy' }).first();
    await expect(securityHeading).toBeVisible();

    // Cambiar a la pestaña de Supabase y verificar comandos
    await page.getByRole('button', { name: 'Supabase DB' }).click();
    const supabaseHeading = page.locator('h2', { hasText: 'Restauración de Supabase' }).first();
    await expect(supabaseHeading).toBeVisible();

    await page.screenshot({ path: 'screenshots/evidence-documentation.png' });
  });
});
