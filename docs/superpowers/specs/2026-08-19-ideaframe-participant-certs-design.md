# IdeaFrame 2026 Participation Certificates

## Overview

Generate and send participation certificates for IdeaFrame 2026 hackathon participants. The certificates use a shared template for both BTEC and MCA tracks, excluding winning teams who will receive separate winner certificates later.

## Data Sources

- `data/ideaframe/btech-team-members.csv` — 123 rows of BTEC track team members
- `data/ideaframe/mca-team-members.csv` — 29 rows of MCA track team members
- `data/ideaframe/total-registrations.csv` — raw registration data (not used directly)

## Winners to Exclude

### BTEC Track
1. **Team Rockstar** (1st Rank)
   - Honey Kaur (leader)
   - Shikha Chauhan
   - Aman aswal
   - Swastika yadav

2. **Team Tech Rangers** (2nd Rank)
   - Shazia Shaikh (leader)
   - Navyansh salunje

3. **Team Kanda** (3rd Rank)
   - Vedika Koli (leader)
   - Mohammed dahodwala
   - Arya
   - Janhavi

### MCA Track
1. **Team The Zeroth Index** (1st Rank)
   - Vrushabh Sonawane (leader)
   - Prajwal Bhosale

2. **Team Prime Techies** (2nd Rank)
   - Aaditya Pandey (leader)
   - Shivam Gupta
   - Ankush Yadav
   - Jignesh Yadav

**Total: 16 people to exclude**

## Output Files

### `data/ideaframe/participants.csv`
Clean CSV with columns: `name`, `email`
- Combined BTEC + MCA participants
- Excludes all winners listed above
- Excludes rows with missing/invalid email addresses

### `data/ideaframe/winners.csv`
Clean CSV with columns: `name`, `email`, `team_name`, `track`
- For future winner certificate generation

## Configuration

### Font
- **Arial** — `/System/Library/Fonts/Supplemental/Arial.ttf`
- Formal, clean, universally readable

### Tier Definition
```python
"ideaframe_participant": {
    "csv": "data/ideaframe/participants.csv",
    "template": "templates/ideaframe-certificate.jpg",
    "output_dir": "output/ideaframe_participants",
    "cert_suffix": "ideaframe_certificate",
    "text_position": (TBD — find via find_position.py),
    "font_size": 66,
    "max_text_width": 1740,
    "email_subject": "Congratulations on participating in IdeaFrame 2026!",
    "email_body": """\
Hi {name},

Thank you for being part of IdeaFrame 2026! Your participation and enthusiasm made the event a success.

Your certificate of participation is attached. We hope to see you at future events!

Best regards,
Hackathon Club & GSA Sakshi Shingole
ITM Skills University""",
}
```

## Implementation Steps

1. **Data Cleanup Script** — Create Python script to:
   - Parse BTEC and MCA team member CSVs
   - Filter out winning team members
   - Extract name and email columns
   - Handle edge cases (missing emails, duplicate entries)
   - Output clean participant CSV

2. **Config Update** — Modify `config.py`:
   - Add `ideaframe_participant` tier
   - Update `FONT_PATH` to Arial

3. **Find Text Position** — Run `find_position.py` on `templates/ideaframe-certificate.jpg` to determine where names should be placed

4. **Generate Certificates** — Run `generate_certs.py ideaframe_participant`

5. **Send Certificates** — Run `send_certs.py ideaframe_participant`

## Edge Cases

- Some team members have missing or invalid email addresses
- Some entries have extra whitespace or formatting issues
- Duplicate email addresses across tracks (filtered by set)
- Team names with trailing/leading whitespace

## Verification

1. Check generated PDFs in `output/ideaframe_participants/`
2. Verify no winner names appear in participant CSV
3. Test send with dry-run before actual sending
