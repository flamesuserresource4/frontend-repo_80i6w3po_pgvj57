# Sync Assist — Standalone AI Calling Service (Laravel) Implementation Guide

This guide walks you through building a production-ready, standalone Laravel application that powers AI-driven outbound calling for real-estate use cases. You’ll implement property/contact management, AI calls via ElevenLabs, lead tracking and scoring, call recordings and transcripts, and automated interest-level analysis with OpenAI — with a secure, queued, and observable workflow end-to-end.

---

## 1) System Architecture

Text-based diagram (high level):

```
+--------------------+        +----------------------+        +------------------+
| Sync Assist Admin  |  API   |  Laravel App (API)   |  HTTPS | ElevenLabs Voice |
| (Filament/Livewire)| <----> |  - Auth (Laravel)    | <----> |  Agent Platform  |
|                    |        |  - REST Endpoints    |        |  (Outbound Calls) |
+--------------------+        |  - Queue (Redis)     |        +------------------+
                              |  - Jobs/Events       |                ^
                              |  - S3 Storage        |                |
                              |  - Webhooks          |                | Webhook (POST)
                              +----------+-----------+                |
                                         |                            |
                                         v                            |
                                     +---+-------------+              |
                                     | Mongo/SQL DB    |              |
                                     | (Eloquent)      |              |
                                     +-----------------+              |
                                         ^                            |
                                         | OpenAI (HTTPS) <-----------+
                                         |
                                         +--> Interest-level analysis
```

- Technology stack: Laravel 12 (API/backend), ElevenLabs API (calling + webhooks), OpenAI API (analysis), S3-compatible storage for recordings, Redis-backed queues (Supervisor) for async processing, Filament + Livewire for admin UI.
- Data flow (typical call):
  1) Admin selects leads → triggers AI outbound calls via ElevenLabs.
  2) ElevenLabs fetches dynamic client data just-in-time from your API.
  3) Call completes → ElevenLabs sends webhook with transcript, summary, recording URL, conversation_id.
  4) Queue job parses webhook, stores assets (S3), creates a Note, triggers OpenAI to classify interest level, and updates lead-property pivot.
  5) Admin sees updated lead status and can replay recordings.
- Webhook handling: Dedicated endpoint validates signatures, enqueues a job, never blocks on heavy work. Persistent logs/alerts on failures.

---

## 2) Database Schema

Tables overview:
- users — Agents/staff managing properties
- properties — Rental and sales listings
- contacts — Leads and prospects
- contact_property — Pivot between contacts and properties (stores per-contact interest, source)
- notes — Call summaries, transcripts, general activity logs
- jobs — Queue (Laravel default)

Recommended columns and indexes:

users
- id (bigint, PK)
- name (string, index)
- email (string, unique)
- phone (string, nullable)
- password (string)
- remember_token (string, nullable)
- timestamps

properties
- id (bigint, PK)
- user_id (FK → users.id, index)
- status (enum: draft, active, sold, leased, archived; index)
- listing_type (enum: sale, rent; index)
- address (string, index)
- suburb (string, index)
- state (string, index)
- postcode (string, index)
- price (integer, nullable)
- rental_period (enum: week, month, null)
- bedrooms (tinyint, nullable)
- bathrooms (tinyint, nullable)
- carspaces (tinyint, nullable)
- headline (string, nullable)
- description (text, nullable)
- features (json, nullable)
- auction_date (datetime, nullable)
- date_available (date, nullable)
- timestamps

contacts
- id (bigint, PK)
- first_name (string)
- last_name (string, nullable)
- email (string, nullable, index)
- phone (string, index)
- country_code (string, default AU)
- source (string, nullable)
- timestamps

contact_property (pivot)
- id (bigint, PK)
- contact_id (FK → contacts.id, index)
- property_id (FK → properties.id, index)
- interest_level (enum: unknown, cold, warm, hot; default unknown, index)
- interest_score (smallint, default 0)
- source (string, nullable)
- last_contacted_at (datetime, nullable)
- last_conversation_id (string, nullable)
- timestamps
- unique index on (contact_id, property_id)

notes
- id (bigint, PK)
- notable_type (morphs) — e.g., App\Models\Contact or App\Models\Property
- notable_id (bigint)
- user_id (FK → users.id, nullable, index) — author/owner
- type (enum: call_summary, transcript, general)
- title (string, nullable)
- body (longText, nullable)
- conversation_id (string, nullable, index)
- recording_path (string, nullable) — S3 key
- transcript_path (string, nullable) — S3/local path
- meta (json, nullable)
- timestamps

jobs (Laravel default)
- Standard schema from queue:table

Enum types
- NoteType: call_summary, transcript, general
- PropertyStatus: draft, active, sold, leased, archived
- ListingTypes: sale, rent
- InterestLevel: unknown, cold, warm, hot

---

## 3) Models and Relationships

Property (casts + relationships)
- casts: features → array
- relationships: belongsTo(User), belongsToMany(Contact)->withPivot(interest_level, interest_score, source, last_contacted_at, last_conversation_id)->withTimestamps(), hasMany(Notes via morphMany)

Contact
- relationships: belongsToMany(Property) with the same pivot + morphMany(Notes)

Note
- relationships: morphTo(notable), belongsTo(User)
- helpers: getRecordingUrlAttribute() to generate a signed S3 URL, getTranscriptContentAttribute() to fetch transcript text.

---

## 4) Core Services

app/Services/ElevenLabsService.php
- initiateOutboundCall(array $payload): Creates a call via ElevenLabs API with agent_id, phone_number_id, and client_data (dynamic variables). Handles formatting/validation.
- formatPhoneNumber(string $raw, string $country = 'AU'): Returns E.164 format (+61...).
- isValidPhoneNumber(string $raw, string $country = 'AU'): Basic validation via libphonenumber or regex fallback.
- Client-data caching: Cache::remember for short TTL to serve ElevenLabs dynamic variable pulls.

app/Services/OpenAIService.php
- analyzeCallSummaryForInterestLevel(string $summary): Returns normalized interest classification and score.
- Robust retry with exponential backoff on 429/5xx.
- Strict response parsing/validation to allowed enum set; sensible defaults on failure.

---

## 5) Controllers and Routes

ElevenLabsController
- handleWebhook(): Verifies signature, enqueues ProcessElevenLabsWebhook with the raw payload.
- conversationInitiationClientData(): Serves dynamic variables for a conversation_id or per-contact call initiation.

API Routes
- POST /api/elevenlabs-webhook — Receives transcripts/summaries
- POST /api/elevenlabs-client-data — Sends dynamic variables to ElevenLabs

---

## 6) Queue Jobs

ProcessElevenLabsWebhook
- Parse webhook JSON, extract conversation_id, recording URL, transcript and summary.
- Save transcript to storage (local or S3) and create a Note with metadata.
- Download and persist recording to S3.
- Trigger OpenAI analysis to classify interest level and compute an interest score.
- Update contact_property pivot interest_level/score and timestamps.
- Clear any temporary caches keyed by conversation_id or contact/property IDs.

---

## 7) Frontend Components

PropertyLeads (Livewire + Filament)
- Table showing contacts attached to a property with interest level/status, source, last contacted.
- Bulk actions: AI Call, SMS, Email. AI Call action prepares dynamic variables, fires service.
- initiateAiCalls(): Validates numbers, batches requests, handles toasts and error reporting.
- Feature formatting: Convert features JSON to bullet list the voice agent can read naturally.

PropertyEdit
- Tabbed UI; Leads tab lists pivot records and quick actions.
- URL structure: /rental/listings/{id}?activeTab=leads

---

## 8) Configuration Requirements

Environment variables

```
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
ELEVENLABS_PHONE_NUMBER_ID=
ELEVENLABS_WEBHOOK_SECRET=
OPENAI_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=ap-southeast-2
AWS_S3_BUCKET=
FILESYSTEM_DISK=s3
QUEUE_CONNECTION=redis
```

Service configuration (config/services.php)

```php
'elevenlabs' => [
    'key' => env('ELEVENLABS_API_KEY'),
    'agent_id' => env('ELEVENLABS_AGENT_ID'),
    'phone_number_id' => env('ELEVENLABS_PHONE_NUMBER_ID'),
    'webhook_secret' => env('ELEVENLABS_WEBHOOK_SECRET'),
],
'openai' => [
    'key' => env('OPENAI_API_KEY'),
],
```

---

## 9) Dynamic Variables System

Variables sent to ElevenLabs in client_data:
- Contact: first_name, last_name, contact_email, contact_phone, country_code
- Property: address, suburb, state, postcode, bedrooms, bathrooms, carspaces
- Pricing: price, listing_type, rental_period
- Features: formatted bulleted list string
- Descriptions: headline, description
- Dates: auction_date, date_available
- Agent: agent_name, agent_phone
- IDs: contact_id, property_id, user_id

Formatting tips
- Ensure numeric fields are strings where ElevenLabs expects text.
- Provide human-readable formats for dates and currency.
- Keep features concise and ordered by importance.

---

## 10) ElevenLabs Agent Configuration

System prompt (example)

```
You are Sync Assist, a professional real-estate AI calling agent. Your goal is to qualify interest in {{address}} and collect next steps.

- Always greet the contact by first name: {{first_name}}.
- Use concise, friendly language with a confident tone.
- Mention key facts: {{bedrooms}} bed, {{bathrooms}} bath, {{carspaces}} car space(s), price {{price}} ({{listing_type}}).
- Offer relevant follow-ups: schedule an inspection, send brochure to {{contact_email}}.
- If asked about details not provided, say you’ll have the human agent follow up.
- Summarize the outcome at the end of the call.
```

Webhook setup
- Set conversation data URL to POST /api/elevenlabs-client-data
- Set webhook receiver to POST /api/elevenlabs-webhook
- Add signature header with your secret (e.g., X-ElevenLabs-Signature)

Testing/debugging
- Use known test numbers (where permitted) and ngrok for local tunneling.
- Log raw payloads securely for troubleshooting; never log secrets.

---

## 11) Installation Guide

1) Install Laravel
- composer create-project laravel/laravel sync-assist "^12.0"
- cd sync-assist

2) Configure database and run migrations
- Set DB_ env vars in .env
- php artisan migrate

3) Packages
- Filament + Livewire: composer require filament/filament livewire/livewire
- AWS S3: composer require league/flysystem-aws-s3-v3
- HTTP client: Laravel HTTP client is built-in; optionally: composer require guzzlehttp/guzzle
- Redis queue: composer require predis/predis or use phpredis
- Phone number: composer require giggsey/libphonenumber-for-php

4) Queue worker
- php artisan queue:table && php artisan migrate
- Supervisor config example (/etc/supervisor/conf.d/laravel-worker.conf):

```
[program:laravel-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/html/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
numprocs=4
redirect_stderr=true
stdout_logfile=/var/log/supervisor/laravel-worker.log
```

5) Storage
- Set FILESYSTEM_DISK=s3 and AWS_* vars
- php artisan storage:link (for local if also storing locally)

6) ElevenLabs
- Add webhook URLs in dashboard per your domain.
- Set agent and phone number IDs in env.

7) Local testing
- Run php artisan serve
- Run queue worker locally: php artisan queue:work
- Use ngrok http 8000 to expose endpoints to ElevenLabs.

---

## 12) Key Features to Highlight

- Automatic Note creation with transcript and summary after each call
- Recording download to S3 and signed URL playback
- AI interest-level analysis and scoring updates on pivot
- Conversation ID tracking across notes and pivot
- Proper E.164 phone formatting (AU default) and validation
- Robust error handling, logging, and secure webhook signature verification

---

## 13) Code Examples (Copy/Paste Ready)

Migrations

database/migrations/2024_01_01_000000_create_properties_table.php
```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('properties', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('status', ['draft', 'active', 'sold', 'leased', 'archived'])->index();
            $table->enum('listing_type', ['sale', 'rent'])->index();
            $table->string('address')->index();
            $table->string('suburb')->index();
            $table->string('state')->index();
            $table->string('postcode')->index();
            $table->integer('price')->nullable();
            $table->enum('rental_period', ['week', 'month'])->nullable();
            $table->tinyInteger('bedrooms')->nullable();
            $table->tinyInteger('bathrooms')->nullable();
            $table->tinyInteger('carspaces')->nullable();
            $table->string('headline')->nullable();
            $table->text('description')->nullable();
            $table->json('features')->nullable();
            $table->dateTime('auction_date')->nullable();
            $table->date('date_available')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('properties');
    }
};
```

database/migrations/2024_01_01_000001_create_contacts_table.php
```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('contacts', function (Blueprint $table) {
            $table->id();
            $table->string('first_name');
            $table->string('last_name')->nullable();
            $table->string('email')->nullable()->index();
            $table->string('phone')->index();
            $table->string('country_code')->default('AU');
            $table->string('source')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contacts');
    }
};
```

database/migrations/2024_01_01_000002_create_contact_property_table.php
```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('contact_property', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contact_id')->constrained()->cascadeOnDelete();
            $table->foreignId('property_id')->constrained()->cascadeOnDelete();
            $table->enum('interest_level', ['unknown', 'cold', 'warm', 'hot'])->default('unknown')->index();
            $table->smallInteger('interest_score')->default(0);
            $table->string('source')->nullable();
            $table->dateTime('last_contacted_at')->nullable();
            $table->string('last_conversation_id')->nullable();
            $table->timestamps();
            $table->unique(['contact_id', 'property_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_property');
    }
};
```

database/migrations/2024_01_01_000003_create_notes_table.php
```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('notes', function (Blueprint $table) {
            $table->id();
            $table->morphs('notable');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['call_summary', 'transcript', 'general'])->default('general');
            $table->string('title')->nullable();
            $table->longText('body')->nullable();
            $table->string('conversation_id')->nullable()->index();
            $table->string('recording_path')->nullable();
            $table->string('transcript_path')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notes');
    }
};
```

Models

app/Models/Property.php
```php
<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Property extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id','status','listing_type','address','suburb','state','postcode','price','rental_period',
        'bedrooms','bathrooms','carspaces','headline','description','features','auction_date','date_available'
    ];

    protected $casts = [
        'features' => 'array',
        'auction_date' => 'datetime',
        'date_available' => 'date',
    ];

    public function user() { return $this->belongsTo(User::class); }

    public function contacts(): BelongsToMany
    {
        return $this->belongsToMany(Contact::class)
            ->withPivot(['interest_level','interest_score','source','last_contacted_at','last_conversation_id'])
            ->withTimestamps();
    }

    public function notes(): MorphMany
    {
        return $this->morphMany(Note::class, 'notable');
    }
}
```

app/Models/Contact.php
```php
<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Contact extends Model
{
    use HasFactory;

    protected $fillable = [
        'first_name','last_name','email','phone','country_code','source'
    ];

    public function properties(): BelongsToMany
    {
        return $this->belongsToMany(Property::class)
            ->withPivot(['interest_level','interest_score','source','last_contacted_at','last_conversation_id'])
            ->withTimestamps();
    }

    public function notes(): MorphMany
    {
        return $this->morphMany(Note::class, 'notable');
    }
}
```

app/Models/Note.php
```php
<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Note extends Model
{
    use HasFactory;

    protected $fillable = [
        'notable_type','notable_id','user_id','type','title','body','conversation_id','recording_path','transcript_path','meta'
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function notable() { return $this->morphTo(); }

    public function user() { return $this->belongsTo(User::class); }

    public function getRecordingUrlAttribute(): ?string
    {
        return $this->recording_path ? Storage::disk(config('filesystems.default'))
            ->temporaryUrl($this->recording_path, now()->addMinutes(60)) : null;
    }

    public function getTranscriptContentAttribute(): ?string
    {
        if (!$this->transcript_path) return null;
        return Storage::disk(config('filesystems.default'))->get($this->transcript_path);
    }
}
```

Services

app/Services/ElevenLabsService.php
```php
<?php
namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use libphonenumber\PhoneNumberUtil;
use libphonenumber\PhoneNumberFormat;

class ElevenLabsService
{
    public function initiateOutboundCall(array $args): array
    {
        $to = $this->formatPhoneNumber($args['to'] ?? '');
        if (!$this->isValidPhoneNumber($to)) {
            throw new \InvalidArgumentException('Invalid phone number');
        }

        $payload = [
            'agent_id' => config('services.elevenlabs.agent_id'),
            'phone_number_id' => config('services.elevenlabs.phone_number_id'),
            'to' => $to,
            'client_data' => $args['client_data'] ?? [],
        ];

        $resp = Http::withToken(config('services.elevenlabs.key'))
            ->acceptJson()
            ->post('https://api.elevenlabs.io/v1/calls/outbound', $payload);

        if ($resp->failed()) {
            throw new \RuntimeException('ElevenLabs call initiation failed: '. $resp->body());
        }

        $data = $resp->json();

        if (!empty($args['conversation_id'])) {
            Cache::put($this->cacheKey($args['conversation_id']), $payload['client_data'], now()->addMinutes(15));
        }

        return $data;
    }

    public function cacheKey(string $conversationId): string
    {
        return 'el_client_data:'.Str::of($conversationId)->trim();
    }

    public function formatPhoneNumber(string $raw, string $country = 'AU'): string
    {
        $raw = trim($raw);
        try {
            $util = PhoneNumberUtil::getInstance();
            $num = $util->parse($raw, $country);
            return $util->format($num, PhoneNumberFormat::E164);
        } catch (\Throwable $e) {
            // Fallback: ensure starts with +
            return Str::startsWith($raw, '+') ? $raw : '+'.ltrim($raw, '0');
        }
    }

    public function isValidPhoneNumber(string $raw, string $country = 'AU'): bool
    {
        try {
            $util = PhoneNumberUtil::getInstance();
            $num = $util->parse($raw, $country);
            return $util->isValidNumber($num);
        } catch (\Throwable $e) {
            return preg_match('/^\+?[1-9]\d{7,14}$/', $raw) === 1;
        }
    }
}
```

app/Services/OpenAIService.php
```php
<?php
namespace App\Services;

use Illuminate\Support\Facades\Http;

class OpenAIService
{
    public function analyzeCallSummaryForInterestLevel(string $summary): array
    {
        $prompt = "Classify the lead's interest level for a real-estate listing as one of: unknown, cold, warm, hot. "
            ."Also provide an integer score 0-100. Return strict JSON with keys: interest_level, interest_score, rationale.\n\n"
            ."Summary:\n".$summary;

        $backoff = [1, 2, 4];
        $resp = null;
        foreach ($backoff as $i => $delay) {
            $resp = Http::withToken(config('services.openai.key'))
                ->timeout(60)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => 'gpt-4o-mini',
                    'messages' => [
                        ['role' => 'system', 'content' => 'You are an expert sales analyst. Respond with strict JSON.'],
                        ['role' => 'user', 'content' => $prompt],
                    ],
                    'temperature' => 0.2,
                ]);

            if ($resp->successful()) break;
            if ($resp->status() >= 500 || $resp->status() == 429) {
                sleep($delay);
                continue;
            }
            break;
        }

        if (!$resp || $resp->failed()) {
            return ['interest_level' => 'unknown', 'interest_score' => 0, 'rationale' => 'analysis_failed'];
        }

        $content = data_get($resp->json(), 'choices.0.message.content');
        $parsed = json_decode($content, true);

        $level = in_array(data_get($parsed, 'interest_level'), ['unknown','cold','warm','hot'])
            ? $parsed['interest_level'] : 'unknown';
        $score = (int) max(0, min(100, (int) data_get($parsed, 'interest_score', 0)));
        $rationale = (string) data_get($parsed, 'rationale', '');

        return compact('level','score','rationale');
    }
}
```

Controllers and Routes

app/Http/Controllers/ElevenLabsController.php
```php
<?php
namespace App\Http\Controllers;

use App\Jobs\ProcessElevenLabsWebhook;
use App\Models\Contact;
use App\Models\Property;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ElevenLabsController extends Controller
{
    public function handleWebhook(Request $request)
    {
        $this->verifySignature($request);
        ProcessElevenLabsWebhook::dispatch($request->all());
        return response()->json(['status' => 'accepted']);
    }

    public function conversationInitiationClientData(Request $request)
    {
        $conversationId = (string) $request->input('conversation_id');
        $cached = Cache::get('el_client_data:'.Str::of($conversationId)->trim());
        if ($cached) return response()->json(['client_data' => $cached]);

        $contact = Contact::findOrFail($request->input('contact_id'));
        $property = Property::findOrFail($request->input('property_id'));

        $clientData = $this->buildClientData($contact, $property, $request->user());
        return response()->json(['client_data' => $clientData]);
    }

    protected function verifySignature(Request $request): void
    {
        $secret = config('services.elevenlabs.webhook_secret');
        $sig = $request->header('X-ElevenLabs-Signature');
        $payload = $request->getContent();
        $calc = base64_encode(hash_hmac('sha256', $payload, $secret, true));
        abort_unless(hash_equals($calc, (string) $sig), 401);
    }

    protected function buildClientData(Contact $contact, Property $property, $user = null): array
    {
        $features = collect($property->features ?? [])->filter()->values();
        $featuresText = $features->isEmpty() ? 'No special features provided.'
            : $features->map(fn($f, $i) => ($i+1).'. '.trim((string)$f))->implode("\n");

        return [
            'first_name' => $contact->first_name,
            'contact_email' => $contact->email,
            'contact_phone' => $contact->phone,
            'country_code' => $contact->country_code,
            'address' => $property->address,
            'bedrooms' => (string) $property->bedrooms,
            'bathrooms' => (string) $property->bathrooms,
            'carspaces' => (string) $property->carspaces,
            'price' => (string) $property->price,
            'listing_type' => $property->listing_type,
            'rental_period' => $property->rental_period,
            'headline' => $property->headline,
            'description' => $property->description,
            'auction_date' => optional($property->auction_date)->toDateTimeString(),
            'date_available' => optional($property->date_available)->toDateString(),
            'agent_name' => optional($user)->name,
            'agent_phone' => optional($user)->phone,
            'contact_id' => (string) $contact->id,
            'property_id' => (string) $property->id,
            'user_id' => optional($user)->id ? (string) $user->id : null,
            'features' => $featuresText,
        ];
    }
}
```

routes/api.php
```php
<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ElevenLabsController;

Route::post('/elevenlabs-webhook', [ElevenLabsController::class, 'handleWebhook']);
Route::post('/elevenlabs-client-data', [ElevenLabsController::class, 'conversationInitiationClientData']);
```

Queue Job

app/Jobs/ProcessElevenLabsWebhook.php
```php
<?php
namespace App\Jobs;

use App\Models\Contact;
use App\Models\Note;
use App\Models\Property;
use App\Services\OpenAIService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class ProcessElevenLabsWebhook implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public array $payload) {}

    public function handle(OpenAIService $openai): void
    {
        $data = $this->payload;
        $conversationId = (string) ($data['conversation_id'] ?? '');
        $summary = (string) ($data['summary'] ?? '');
        $transcript = (string) ($data['transcript'] ?? '');
        $recordingUrl = (string) ($data['recording_url'] ?? '');
        $contactId = (int) ($data['contact_id'] ?? 0);
        $propertyId = (int) ($data['property_id'] ?? 0);

        // Persist transcript
        $transcriptPath = null;
        if ($transcript) {
            $transcriptPath = 'calls/'.date('Y/m/d').'/'.$conversationId.'-transcript.txt';
            Storage::put($transcriptPath, $transcript);
        }

        // Download recording to S3
        $recordingPath = null;
        if ($recordingUrl) {
            try {
                $resp = Http::get($recordingUrl);
                if ($resp->successful()) {
                    $recordingPath = 'calls/'.date('Y/m/d').'/'.$conversationId.'-recording.mp3';
                    Storage::put($recordingPath, $resp->body());
                }
            } catch (Throwable $e) {
                Log::warning('Recording download failed', ['error' => $e->getMessage()]);
            }
        }

        // Create Note
        $notable = Contact::find($contactId) ?: Property::find($propertyId);
        if ($notable) {
            Note::create([
                'notable_type' => get_class($notable),
                'notable_id' => $notable->id,
                'type' => 'call_summary',
                'title' => 'AI Call Summary',
                'body' => $summary ?: null,
                'conversation_id' => $conversationId ?: null,
                'recording_path' => $recordingPath,
                'transcript_path' => $transcriptPath,
                'meta' => [
                    'raw' => $data,
                ],
            ]);
        }

        // Interest analysis
        $analysis = $openai->analyzeCallSummaryForInterestLevel($summary);
        $level = $analysis['level'] ?? 'unknown';
        $score = (int) ($analysis['score'] ?? 0);

        if ($contactId && $propertyId) {
            $contact = Contact::find($contactId);
            if ($contact) {
                $contact->properties()->syncWithoutDetaching([
                    $propertyId => [
                        'interest_level' => $level,
                        'interest_score' => $score,
                        'last_contacted_at' => now(),
                        'last_conversation_id' => $conversationId,
                    ]
                ]);
            }
        }
    }
}
```

Livewire Component (PropertyLeads)

app/Livewire/PropertyLeads.php
```php
<?php
namespace App\Livewire;

use App\Models\Contact;
use App\Models\Property;
use App\Services\ElevenLabsService;
use Illuminate\Support\Collection;
use Livewire\Component;

class PropertyLeads extends Component
{
    public Property $property;
    public array $selected = [];

    public function mount(Property $property)
    {
        $this->property = $property;
    }

    public function render()
    {
        return view('livewire.property-leads', [
            'leads' => $this->property->contacts()->withPivot(['interest_level','interest_score','last_contacted_at'])->get(),
        ]);
    }

    public function initiateAiCalls(ElevenLabsService $svc)
    {
        $contacts = Contact::whereIn('id', $this->selected)->get();

        foreach ($contacts as $contact) {
            $clientData = $this->buildClientData($contact, $this->property);
            $svc->initiateOutboundCall([
                'to' => $contact->phone,
                'client_data' => $clientData,
                'conversation_id' => uniqid('conv_', true),
            ]);
        }

        session()->flash('status', 'AI calls initiated');
    }

    protected function buildClientData(Contact $contact, Property $property): array
    {
        $features = collect($property->features ?? [])->filter()->values();
        return [
            'first_name' => $contact->first_name,
            'contact_email' => $contact->email,
            'address' => $property->address,
            'bedrooms' => (string) $property->bedrooms,
            'bathrooms' => (string) $property->bathrooms,
            'carspaces' => (string) $property->carspaces,
            'price' => (string) $property->price,
            'listing_type' => $property->listing_type,
            'rental_period' => $property->rental_period,
            'features' => $features->isEmpty() ? 'No special features.' : $features->implode(', '),
            'contact_id' => (string) $contact->id,
            'property_id' => (string) $property->id,
        ];
    }
}
```

Blade View (livewire/property-leads.blade.php)
```blade
<div>
    <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">Leads</h3>
        <button wire:click="initiateAiCalls" class="px-3 py-2 bg-indigo-600 text-white rounded">AI Call</button>
    </div>
    <table class="w-full text-sm">
        <thead>
            <tr class="text-left">
                <th></th>
                <th>Name</th>
                <th>Phone</th>
                <th>Interest</th>
                <th>Score</th>
                <th>Last Contacted</th>
            </tr>
        </thead>
        <tbody>
            @foreach($leads as $lead)
                <tr class="border-t">
                    <td><input type="checkbox" wire:model="selected" value="{{ $lead->id }}"/></td>
                    <td>{{ $lead->first_name }} {{ $lead->last_name }}</td>
                    <td>{{ $lead->phone }}</td>
                    <td>{{ $lead->pivot->interest_level }}</td>
                    <td>{{ $lead->pivot->interest_score }}</td>
                    <td>{{ optional($lead->pivot->last_contacted_at)->diffForHumans() }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    @if (session('status'))
        <div class="mt-4 text-green-700">{{ session('status') }}</div>
    @endif
</div>
```

Property Edit Route Example

```php
Route::get('/rental/listings/{property}', function (\App\Models\Property $property) {
    return view('properties.edit', [
        'property' => $property,
        'activeTab' => request('activeTab', 'details'),
    ]);
});
```

---

## 14) Testing Guidance

- Queue worker: php artisan queue:work --tries=3
- Webhook monitoring: tail -f storage/logs/laravel.log and use Telescope if installed
- Test AI calls: From the Leads table, select a few leads and trigger “AI Call”; confirm requests in ElevenLabs dashboard
- Verify notes: After webhooks are delivered, ensure a Note is created with transcript_path and recording_path; try playback via signed URL
- Recording downloads: Confirm objects in S3 bucket path calls/YYYY/MM/DD/
- Interest analysis: Check pivot interest_level and interest_score updated; repeat with different summaries to observe classification

---

## Appendix: Security and Observability

- Webhook signature: HMAC-SHA256 using X-ElevenLabs-Signature, constant-time comparison
- Input validation: Strictly validate contact_id/property_id, phone numbers, and enum fields
- Least privilege: Use a dedicated IAM user for S3 with bucket-scoped permissions
- Rate limits: Exponential backoff on OpenAI; transient error retries on downloads
- Idempotency: Use conversation_id to deduplicate webhook processing if the provider retries
- Monitoring: Consider Laravel Horizon for queues, Sentry/Bugsnag for error capture, and CloudWatch/ELK for logs

---

This blueprint provides the complete structure — schema, models, services, controllers, jobs, configuration, and Livewire/Filament UI patterns — to implement Sync Assist as a standalone AI calling platform with reliable, secure, and scalable foundations.
