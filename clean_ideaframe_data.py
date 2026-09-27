#!/usr/bin/env python3
"""Clean IdeaFrame CSV data: separate winners from participants."""

import csv
import re
from pathlib import Path

# Winners to exclude (by name, case-insensitive matching)
WINNER_NAMES = {
    # BTEC 1st Rank - Team Rockstar
    "honey kaur",
    "shikha chauhan",
    "aman aswal",
    "swastika yadav",
    # BTEC 2nd Rank - Team Tech Rangers
    "shazia shaikh",
    "navyansh salunje",
    # BTEC 3rd Rank - Team Kanda
    "vedika koli",
    "mohammed dahodwala",
    "arya",
    "janhavi",
    # MCA 1st Rank - Team The Zeroth Index
    "vrushabh sonawane",
    "prajwal bhosale",
    # MCA 2nd Rank - Team Prime Techies
    "aaditya pandey",
    "shivam gupta",
    "ankush yadav",
    "jignesh yadav",
}

DATA_DIR = Path("data/ideaframe")


def normalize_name(name: str) -> str:
    """Normalize name for comparison."""
    return re.sub(r"\s+", " ", name.strip().lower())


def is_valid_email(email: str) -> bool:
    """Basic email validation."""
    email = email.strip()
    if not email:
        return False
    # Check for obvious invalid emails
    if "@" not in email or "." not in email:
        return False
    # Check for malformed emails from the CSV
    if email.startswith("@") or email.endswith("@"):
        return False
    return True


def clean_email(email: str) -> str:
    """Clean email address."""
    email = email.strip()
    # Remove extra spaces
    email = re.sub(r"\s+", "", email)
    # Handle "Name <email>" format — extract just the email
    match = re.search(r"<([^>]+)>", email)
    if match:
        email = match.group(1)
    return email


def parse_team_members(filepath: Path, track: str) -> list[dict]:
    """Parse team members CSV and return list of dicts with name, email, team."""
    members = []
    with open(filepath, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get("name", "").strip()
            email = clean_email(row.get("email", ""))
            team_name = row.get("team_name", "").strip()
            
            if name and is_valid_email(email):
                members.append({
                    "name": name,
                    "email": email,
                    "team_name": team_name,
                    "track": track,
                })
    return members


def main():
    # Parse both tracks
    btec_file = DATA_DIR / "btech-team-members.csv"
    mca_file = DATA_DIR / "mca-team-members.csv"
    
    all_members = []
    if btec_file.exists():
        all_members.extend(parse_team_members(btec_file, "BTEC"))
        print(f"Parsed {len(all_members)} BTEC members")
    
    if mca_file.exists():
        mca_members = parse_team_members(mca_file, "MCA")
        all_members.extend(mca_members)
        print(f"Parsed {len(mca_members)} MCA members")
    
    print(f"Total members: {len(all_members)}")
    
    # Separate winners and participants
    participants = []
    winners = []
    
    for member in all_members:
        normalized = normalize_name(member["name"])
        if normalized in WINNER_NAMES:
            winners.append(member)
        else:
            participants.append(member)
    
    print(f"Winners: {len(winners)}")
    print(f"Participants: {len(participants)}")
    
    # Deduplicate participants by email
    seen_emails = set()
    unique_participants = []
    for p in participants:
        if p["email"].lower() not in seen_emails:
            seen_emails.add(p["email"].lower())
            unique_participants.append(p)
    
    print(f"Unique participants: {len(unique_participants)}")
    
    # Write participants CSV (name, email only)
    participants_file = DATA_DIR / "participants.csv"
    with open(participants_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "email"])
        writer.writeheader()
        for p in unique_participants:
            writer.writerow({"name": p["name"], "email": p["email"]})
    
    print(f"\nWrote {len(unique_participants)} participants to {participants_file}")
    
    # Write winners CSV (name, email, team_name, track)
    winners_file = DATA_DIR / "winners.csv"
    with open(winners_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "email", "team_name", "track"])
        writer.writeheader()
        for w in winners:
            writer.writerow(w)
    
    print(f"Wrote {len(winners)} winners to {winners_file}")
    
    # Print some sample participants
    print("\nSample participants:")
    for p in unique_participants[:5]:
        print(f"  {p['name']} <{p['email']}>")
    
    # Check for any winners that weren't matched
    matched_names = {normalize_name(w["name"]) for w in winners}
    unmatched = WINNER_NAMES - matched_names
    if unmatched:
        print(f"\nWarning: Could not find these winners in the data:")
        for name in unmatched:
            print(f"  - {name}")


if __name__ == "__main__":
    main()
