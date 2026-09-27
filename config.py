# Email addresses copied on every certificate email
CC_ADDRESSES = ["prasadj@itm.edu", "kashmirat@itm.edu"]

# SMTP settings (Gmail default, change host/port for other providers)
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587

# Font settings (applied to all tiers)
FONT_PATH = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_COLOR = (0, 0, 0)  # RGB black

# Frosted-glass pill effect behind the name
PILL_COLOR = (15, 15, 15, 140)  # RGBA dark tint
PILL_PADDING_X = 84             # horizontal padding around text
PILL_PADDING_Y = 42             # vertical padding around text

# Certificate tiers — one entry per category.
# Duplicate the example below and adjust values for each tier.
#
# Keys:
#   csv             - path to CSV with columns: name, email
#   template        - path to the certificate template image
#   output_dir      - where generated PDFs are saved
#   cert_suffix     - appended to filename: <sanitized_name>_<cert_suffix>.pdf
#   text_position   - (x, y) pixel center where the name is drawn
#   font_size       - starting font size (auto-shrinks to fit)
#   max_text_width  - max pixel width before font shrinks
#   email_subject   - subject line for the certificate email
#   email_body      - plain text body, use {name} as placeholder
#
# To find text_position, run:
#   python find_position.py templates/your_template.jpg
TIERS = {
    "winner": {
        "csv": "data/winner.csv",
        "template": "templates/winner_template.jpg",
        "output_dir": "output/winner",
        "cert_suffix": "winner_certificate",
        "text_position": (1263, 675),
        "font_size": 66,
        "max_text_width": 1740,
        "email_subject": "Congratulations — You won!",
        "email_body": """\
Hi {name},

Congratulations! Your team took the top spot.

Your winner's certificate is attached. Frame it, post it — you earned it.

See you at the next one!

Best,
The Organizers\
""",
    },
    # "runner_up": {
    #     "csv": "data/runner_up.csv",
    #     "template": "templates/runner_up_template.jpg",
    #     "output_dir": "output/runner_up",
    #     "cert_suffix": "runner_up_certificate",
    #     "text_position": (1263, 675),
    #     "font_size": 66,
    #     "max_text_width": 1740,
    #     "email_subject": "Runner Up!",
    #     "email_body": """\
    # Hi {name},
    #
    # Your team finished Runner Up. That's a serious achievement.
    #
    # Your certificate is attached. Wear it well.
    #
    # Best,
    # The Organizers\
    # """,
    # },
    # "participants": {
    #     "csv": "data/participants.csv",
    #     "template": "templates/participant_template.jpg",
    #     "output_dir": "output/participants",
    #     "cert_suffix": "certificate",
    #     "text_position": (1263, 675),
    #     "font_size": 66,
    #     "max_text_width": 1740,
    #     "email_subject": "Your certificate",
    #     "email_body": """\
    # Hi {name},
    #
    # You showed up and built something. That alone puts you ahead.
    #
    # Your certificate is attached. See you at the next one!
    #
    # Best,
    # The Organizers\
    # """,
    # },
    "ideaframe_participant": {
        "csv": "data/ideaframe/participants.csv",
        "template": "templates/ideaframe-certificate.jpg",
        "output_dir": "output/ideaframe_participants",
        "cert_suffix": "ideaframe_certificate",
        "text_position": (800, 393),  # Moved down 5px from 388
        "font_size": 36,
        "max_text_width": 1740,
        "apply_glass_effect": False,  # No frosted glass for this event
        "email_subject": "Congratulations on participating in IdeaFrame 2026!",
        "email_body": """\
Hi {name},

Thank you for being part of IdeaFrame 2026! Your participation and enthusiasm made the event a success.

Your certificate of participation is attached. We hope to see you at future events!

Best regards,
Hackathon Club & GSA Sakshi Shingole
ITM Skills University""",
    },
    "portfolio_competition": {
        "csv": "data/portfolio_hackathon.csv",
        "template": "templates/portfolio_competition.jpg",
        "output_dir": "output/portfolio_competition",
        "cert_suffix": "portfolio_certificate",
        "text_position": (1000, 750),
        "font_size": 48,  # Canva font size 24 ≈ 48px
        "max_text_width": 1400,
        "font_path": "fonts/GlacialIndifference-Regular.otf",
        "apply_glass_effect": False,
        "email_subject": "Your Portfolio Hackathon Certificate",
        "email_body": """\
Hi {name},

Thank you for participating in the Student Portfolio Hackathon!

The purpose of this hackathon was to provide every student with an opportunity to experience an industry-oriented evaluation environment. Throughout the process, various aspects of your professional readiness were observed, including how confidently you presented yourself, how well you understood your portfolio and projects, how effectively you communicated your skills and achievements, your technical and domain understanding, your professionalism, your clarity of career interests, and your ability to respond to questions and feedback.

The feedback shared by industry experts is valuable for your growth and career development. We encourage you to reflect on it and work towards strengthening your skills further.

Your certificate of participation is attached. We appreciate your dedication, technical skills, and the effort you put forth in creating your project.

Best regards,
Hackathon Club, ITM Skills University""",
    },
}
