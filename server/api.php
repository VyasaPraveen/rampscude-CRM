<?php
/**
 * Ramps Cube CRM — self-hosted sync endpoint.
 *
 * Replaces Firestore. Each module's collection is stored as a JSON string in one
 * row of `crm_workspace`. The browser client (src/lib/sync.ts) polls GET for
 * changes and POSTs updates. Last-write-wins per module.
 *
 * GET  /api.php?since=<ms>   -> { now, modules: { key: { payload, updatedAt } } }
 * POST /api.php  {key,payload}-> { ok, updatedAt }
 *
 * Auth: shared bearer token (Authorization: Bearer <token>), matched against the
 * token in crm-sync-config.php, which lives ABOVE the web root.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
// Hardening: never MIME-sniff the JSON, never leak the URL as a referrer, and make
// clear this endpoint is not meant to be framed.
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Frame-Options: DENY');
// Keep the endpoint same-origin only — no other site may read or embed its responses.
// (No Access-Control-Allow-Origin is sent, so browsers block all cross-origin reads.)
header('Cross-Origin-Resource-Policy: same-origin');

// Config lives in the account home, above every web root, so it is never served.
$configPath = '/home/u852408598/crm-sync-config.php';
if (!is_file($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'not configured']);
    exit;
}
$cfg = require $configPath;

/** Extract the bearer token across the various ways the header can arrive. */
function bearer_token(): string {
    $h = '';
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $h = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $h = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) { $h = $v; break; }
        }
    }
    if (stripos($h, 'Bearer ') === 0) return substr($h, 7);
    if (!empty($_SERVER['HTTP_X_SYNC_TOKEN'])) return $_SERVER['HTTP_X_SYNC_TOKEN'];
    return '';
}

if (!hash_equals((string) $cfg['token'], bearer_token())) {
    http_response_code(401);
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

$mysqli = @new mysqli($cfg['db_host'], $cfg['db_user'], $cfg['db_pass'], $cfg['db_name']);
if ($mysqli->connect_errno) {
    http_response_code(500);
    echo json_encode(['error' => 'database unavailable']);
    exit;
}
$mysqli->set_charset('utf8mb4');

/**
 * Opportunistic daily snapshot.
 *
 * This host has no cron, and the workspace's only other copy is whatever an admin
 * remembers to download. A bulk delete on one device syncs everywhere, so without a
 * server-side history there is no way back. The app polls this endpoint constantly
 * while anyone is working, so the first authenticated call each day writes a snapshot
 * and prunes old ones.
 *
 * Written in the app's own backup format, so a snapshot can be restored straight
 * through Settings > Restore without any conversion.
 *
 * Never allowed to affect the response: the sync API must keep working even if the
 * filesystem is full or read-only.
 */
function maybe_daily_snapshot(mysqli $db, array $cfg): void {
    try {
        $dir = isset($cfg['backup_dir']) ? $cfg['backup_dir'] : '/home/u852408598/crm-backups';
        $auto = $dir . '/auto';
        if (!is_dir($auto) && !@mkdir($auto, 0700, true) && !is_dir($auto)) return;

        $keep = isset($cfg['backup_keep_days']) ? (int) $cfg['backup_keep_days'] : 30;
        $today = date('Y-m-d');
        $target = $auto . '/' . $today . '.json';

        // Atomic claim: whichever concurrent request creates the file does the work,
        // the rest see EEXIST and skip. No lock file, no race.
        $handle = @fopen($target, 'xb');
        if ($handle === false) return;

        $modules = array();
        $res = $db->query('SELECT module_key, payload FROM crm_workspace');
        if ($res) {
            while ($row = $res->fetch_assoc()) {
                $decoded = json_decode($row['payload'], true);
                // Keep the raw string if it will not decode, rather than dropping the module.
                $modules[$row['module_key']] = $decoded === null ? $row['payload'] : $decoded;
            }
            $res->free();
        }

        if (count($modules) === 0) {
            // Nothing to snapshot - do not leave a zero-byte file claiming today is done.
            fclose($handle);
            @unlink($target);
            return;
        }

        $doc = array(
            'app'        => 'Ramps Cube CRM',
            'version'    => 'server-auto',
            'exportedAt' => date('c'),
            'modules'    => $modules,
        );
        fwrite($handle, json_encode($doc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        fclose($handle);
        @chmod($target, 0600);

        // Prune anything past the retention window.
        $cutoff = time() - ($keep * 86400);
        foreach ((array) glob($auto . '/*.json') as $file) {
            if (@filemtime($file) < $cutoff) @unlink($file);
        }
    } catch (Throwable $e) {
        // Backups are best-effort; the sync API must not fail because of them.
    }
}

maybe_daily_snapshot($mysqli, $cfg);

$method = $_SERVER['REQUEST_METHOD'];
$now = (int) round(microtime(true) * 1000);

if ($method === 'GET') {
    $since = isset($_GET['since']) ? (int) $_GET['since'] : 0;
    $stmt = $mysqli->prepare('SELECT module_key, payload, updated_at FROM crm_workspace WHERE updated_at > ?');
    $stmt->bind_param('i', $since);
    $stmt->execute();
    $res = $stmt->get_result();
    $modules = [];
    while ($row = $res->fetch_assoc()) {
        $modules[$row['module_key']] = [
            'payload'   => $row['payload'],
            'updatedAt' => (int) $row['updated_at'],
        ];
    }
    echo json_encode(['now' => $now, 'modules' => (object) $modules]);
    exit;
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $key = isset($body['key']) ? (string) $body['key'] : '';
    $payload = $body['payload'] ?? null;
    // Module keys are app-defined slugs; constrain the charset so nothing unexpected is
    // ever persisted (defense in depth on top of the prepared statement).
    if ($key === '' || !preg_match('/^[A-Za-z0-9_.:-]{1,64}$/', $key) || !is_string($payload)) {
        http_response_code(400);
        echo json_encode(['error' => 'bad request']);
        exit;
    }
    if (strlen($payload) > 4000000) {
        http_response_code(413);
        echo json_encode(['error' => 'payload too large']);
        exit;
    }
    $stmt = $mysqli->prepare(
        'INSERT INTO crm_workspace (module_key, payload, updated_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)'
    );
    $stmt->bind_param('ssi', $key, $payload, $now);
    $ok = $stmt->execute();
    if (!$ok) { http_response_code(500); echo json_encode(['error' => 'write failed']); exit; }
    echo json_encode(['ok' => true, 'updatedAt' => $now]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'method not allowed']);
