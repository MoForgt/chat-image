<?php
// AI 生图代理：无图走 /images/generations（JSON），带图走 /images/edits（multipart，支持图生图/图片编辑）
// 部署要求：PHP 8.0+（str_starts_with），服务器需启用 curl 扩展
// 前端请求体：{ apiUrl, apiKey, model, prompt, image }

@ini_set('zlib.output_compression', 'Off');
while (ob_get_level() > 0) {
    ob_end_clean();
}
@ini_set('max_execution_time', '0');
@ini_set('memory_limit', '512M');

// 拼接完整 API 地址：已包含对应后缀则原样使用，否则追加（与前端 api-utils.js 逻辑一致）
function buildUrl($base, $suffix)
{
    $url = trim((string) $base);
    $url = rtrim($url, '/');
    if ($url === '') return '';
    return (stripos($url, $suffix) !== false) ? $url : $url . $suffix;
}

function sendJson($status, $data)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents('php://input');
$req = json_decode($raw, true);
if (!is_array($req)) {
    sendJson(400, ['error' => '请求体不是合法的 JSON']);
}

$apiUrl = trim((string) ($req['apiUrl'] ?? ''));
$apiKey = trim((string) ($req['apiKey'] ?? ''));
$model = $req['model'] ?? '';
$prompt = $req['prompt'] ?? '';
$image = $req['image'] ?? null;

$hasImage = is_string($image) && (
    str_starts_with($image, 'data:image/') || preg_match('#^https?://#i', $image)
);
$url = buildUrl($apiUrl, $hasImage ? '/images/edits' : '/images/generations');
if (!$url) {
    sendJson(400, ['error' => '未配置 API 地址']);
}

$headers = ['Authorization: Bearer ' . $apiKey];
$tmp = null;

if ($hasImage) {
    // 图片来源：data URL 直接解出二进制；远程 URL 由服务端下载（无浏览器跨域限制）
    $mime = 'image/png';
    $bin = null;
    if (str_starts_with($image, 'data:')) {
        if (!preg_match('#^data:(.*?);base64,(.*)$#s', $image, $m)) {
            sendJson(400, ['error' => '图片数据格式不正确']);
        }
        $mime = $m[1];
        $bin = base64_decode($m[2]);
    } else {
        $ch = curl_init($image);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_HEADERFUNCTION => function ($ch, $header) use (&$mime) {
                if (preg_match('#^Content-Type:\s*(.+)\s*$#i', $header, $m)) {
                    $mime = trim($m[1]);
                }
                return strlen($header);
            },
        ]);
        $bin = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($bin === false || $code >= 400) {
            sendJson(400, ['error' => '图片下载失败（' . ($code ?: '网络错误') . '）']);
        }
    }

    $cleanMime = explode(';', $mime)[0];
    $extMap = ['image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif', 'image/jpeg' => 'jpg', 'image/jpg' => 'jpg'];
    $ext = $extMap[$cleanMime] ?? 'png';

    $tmp = tempnam(sys_get_temp_dir(), 'img_');
    file_put_contents($tmp, $bin);

    $file = new CURLFile($tmp, $cleanMime, 'upload.' . $ext);
    $fields = [
        'model' => $model,
        'prompt' => $prompt !== '' ? $prompt : '编辑这张图片',
        'n' => '1',
        'size' => '1024x1024',
        'image' => $file,
    ];
} else {
    $headers[] = 'Content-Type: application/json';
    $fields = json_encode([
        'model' => $model,
        'prompt' => $prompt,
        'n' => 1,
        'size' => '1024x1024',
    ]);
}

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_POSTFIELDS => $fields, // 含 CURLFile 对象时 curl 自动以 multipart/form-data 发送
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 120,
    CURLOPT_CONNECTTIMEOUT => 30,
]);
$body = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$err = curl_error($ch);
curl_close($ch);

if ($tmp !== null && file_exists($tmp)) {
    @unlink($tmp);
}

if ($body === false) {
    sendJson(502, ['error' => '代理请求失败：' . $err]);
}

header('Content-Type: application/json; charset=utf-8');
http_response_code($code);
echo $body;
