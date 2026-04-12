use serde::{Deserialize, Serialize};

/// 房间状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomStatus {
    pub code: String,
    pub has_sender: bool,
    pub has_receiver: bool,
    pub created_at: u64,
}

/// 4 字母大写词 + 2 位安全数字（排除 0/1）的房间码
/// 格式示例：BOOK23, STAR89, HOPE56
pub fn generate_room_code() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    const WORDS: &[&str] = &[
        "ABLE", "ACID", "AGED", "ALSO", "AREA", "ARMY", "AWAY",
        "BABY", "BACK", "BALL", "BAND", "BANK", "BASE", "BATH", "BEAR", "BEAT", "BEEN", "BELL",
        "BEST", "BILL", "BIRD", "BLOW", "BLUE", "BOAT", "BODY", "BOND", "BONE", "BOOK",
        "BOOT", "BORN", "BOSS", "BOTH", "BURN", "BUSH", "BUSY", "CALL", "CALM", "CAME", "CAMP",
        "CARD", "CARE", "CASE", "CASH", "CAST", "CELL", "CHAT", "CHIP", "CITY", "CLUB", "COAL",
        "COAT", "CODE", "COLD", "COME", "COOK", "COOL", "COPE", "COPY", "CORE", "COST", "CREW",
        "CROP", "DARK", "DATA", "DATE", "DAWN", "DEAL", "DEAR", "DEBT", "DEEP", "DENY",
        "DESK", "DIET", "DISH", "DISK", "DOCK", "DOES", "DONE", "DOOR", "DOSE", "DOWN",
        "DRAW", "DREW", "DROP", "DRUM", "DUAL", "DUKE", "DUST", "DUTY", "EACH",
        "EARN", "EASE", "EAST", "EASY", "EDGE", "ELSE", "EVEN", "EVER", "EXAM", "EXEC",
        "EXIT", "FACE", "FACT", "FAIR", "FALL", "FAME", "FARM", "FAST", "FATE",
        "FEED", "FEEL", "FEET", "FELL", "FELT", "FILE", "FILL", "FILM", "FIND", "FINE", "FIRE",
        "FIRM", "FISH", "FIVE", "FLAG", "FLAT", "FLED", "FLEW", "FLIP", "FLOW", "FOLK", "FOND",
        "FOOD", "FOOT", "FORD", "FORE", "FORK", "FORM", "FORT", "FOUR", "FREE",
        "FROM", "FUEL", "FULL", "FUND", "FUSE", "GAIN", "GAME", "GATE", "GAVE",
        "GEAR", "GENE", "GIFT", "GIRL", "GIVE", "GLAD", "GLOW", "GLUE", "GOAL", "GOES", "GOLD",
        "GOLF", "GONE", "GOOD", "GRAB", "GRAY", "GREW", "GREY", "GRID", "GRIP", "GROW", "GULF",
        "GURU", "HAIR", "HALF", "HALL", "HALT", "HAND", "HARD",
        "HAVE", "HEAD", "HEAL", "HEAP", "HEAR", "HEAT", "HELD", "HELP", "HERE", "HERO",
        "HIGH", "HIKE", "HILL", "HINT", "HIRE", "HOLD", "HOLE", "HOLY", "HOME", "HOOD", "HOOK",
        "HOPE", "HOST", "HOUR", "HUGE", "HUNG", "HUNT", "ICON", "IDEA", "INCH", "INTO",
        "IRON", "ITEM", "JACK", "JAZZ", "JEAN", "JOBS", "JOIN", "JOKE", "JUMP", "JUNE",
        "JURY", "JUST", "KEEN", "KEEP", "KEPT", "KICK", "KIDS", "KIND", "KING", "KNEE",
        "KNEW", "KNIT", "KNOT", "KNOW", "LACK", "LADY", "LAID", "LAKE", "LAMP", "LAND", "LANE",
        "LAST", "LATE", "LAWN", "LEAD", "LEAF", "LEAN", "LEFT", "LEND", "LENS", "LESS", "LIFE",
        "LIFT", "LIKE", "LIMB", "LIME", "LINE", "LINK", "LION", "LIST", "LIVE", "LOAD", "LOAN",
        "LOCK", "LOGO", "LONG", "LOOK", "LORD", "LOSE", "LOSS", "LOST", "LOTS", "LOUD", "LOVE",
        "LUCK", "LUNG", "MADE", "MAIL", "MAIN", "MAKE", "MALE", "MALL", "MANY", "MARK", "MASK",
        "MASS", "MATE", "MAZE", "MEAL", "MEAN", "MEAT", "MEET", "MELT", "MENU", "MERE", "MESS",
        "MILD", "MILE", "MILK", "MILL", "MIND", "MINT", "MISS", "MODE", "MOOD", "MOON",
        "MORE", "MOST", "MOVE", "MUCH", "MUST", "MYTH", "NAIL", "NAME", "NAVY", "NEAR", "NEAT",
        "NECK", "NEED", "NEWS", "NEXT", "NICE", "NINE", "NODE", "NONE", "NORM", "NOSE", "NOTE",
        "NOUN", "ODDS", "OKAY", "ONCE", "ONLY", "ONTO", "OPEN", "ORAL", "OURS", "OVER", "PACE",
        "PACK", "PAGE", "PAID", "PAIR", "PALE", "PALM", "PARK", "PART", "PASS",
        "PAST", "PATH", "PEAK", "PEER", "PICK", "PILE", "PINE", "PINK", "PIPE", "PLAN", "PLAY",
        "PLEA", "PLOT", "PLUG", "PLUS", "POEM", "POET", "POLE", "POLL", "POND", "POOL",
        "POPE", "PORK", "PORT", "POSE", "POST", "POUR", "PRAY", "PULL", "PUMP", "PURE", "PUSH",
        "QUIT", "RACE", "RACK", "RAID", "RAIL", "RAIN", "RANK", "RARE", "RATE", "READ",
        "REAL", "REAR", "RELY", "RENT", "REST", "RICE", "RICH", "RIDE", "RING", "RISE", "RISK",
        "ROAD", "ROCK", "RODE", "ROLE", "ROLL", "ROOF", "ROOM", "ROOT", "ROPE", "ROSE",
        "RULE", "RUSH", "SAFE", "SAGE", "SAID", "SAKE", "SALE", "SALT", "SAME", "SAND",
        "SANG", "SAVE", "SEAL", "SEAT", "SEED", "SEEK", "SEEM", "SEEN", "SELF", "SELL", "SEND",
        "SENT", "SEPT", "SHED", "SHIP", "SHOP", "SHOT", "SHOW", "SHUT", "SIDE", "SIGH",
        "SIGN", "SILK", "SING", "SINK", "SITE", "SIZE", "SKIN", "SLAM", "SLID", "SLIM", "SLIP",
        "SLOT", "SLOW", "SNAP", "SNOW", "SOAP", "SOCK", "SOFT", "SOIL", "SOLD", "SOLE", "SOME",
        "SONG", "SOON", "SORT", "SOUL", "SPIN", "SPOT", "STAR", "STAY", "STEM", "STEP", "STIR",
        "STOP", "SUCH", "SUIT", "SURE", "SWIM", "TAIL", "TAKE", "TALE", "TALK", "TALL", "TANK",
        "TAPE", "TASK", "TAXI", "TEAM", "TEAR", "TELL", "TEND", "TENT", "TERM", "TEST", "TEXT",
        "THAN", "THAT", "THEM", "THEN", "THEY", "THIN", "THIS", "THUS", "TICK", "TIDE", "TIDY",
        "TIED", "TIER", "TILL", "TIME", "TINY", "TIRE", "TOAD", "TOLD", "TOLL", "TONE", "TOOK",
        "TOOL", "TOPS", "TORE", "TORN", "TOUR", "TOWN", "TREE", "TRIM", "TRIO", "TRIP",
        "TRUE", "TUBE", "TUCK", "TUNE", "TURN", "TWIN", "TYPE", "UNIT", "UPON", "URGE",
        "USED", "USER", "VALE", "VARY", "VAST", "VERB", "VERY", "VIEW", "VINE", "VISA",
        "VOLT", "VOTE", "WADE", "WAGE", "WAIT", "WAKE", "WALK", "WALL", "WANT", "WARD",
        "WARM", "WARN", "WASH", "WAVE", "WEAK", "WEAR", "WEED", "WEEK", "WELL", "WENT", "WERE",
        "WEST", "WHAT", "WHEN", "WHOM", "WIDE", "WIFE", "WILD", "WILL", "WIND", "WINE", "WING",
        "WIRE", "WISE", "WISH", "WITH", "WOKE", "WOLF", "WOOD", "WOOL", "WORD", "WORE", "WORK",
        "WORN", "WRAP", "YARD", "YEAH", "YEAR", "YOUR", "ZERO", "ZONE", "ZOOM",
    ];
    const SAFE_DIGITS: &[u8] = b"23456789";

    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();

    let mut rng = seed;

    // 选词
    rng = rng.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    let word = WORDS[(rng as usize) % WORDS.len()];

    // 两位安全数字
    rng = rng.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    let d1 = SAFE_DIGITS[(rng as usize) % SAFE_DIGITS.len()];
    rng = rng.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
    let d2 = SAFE_DIGITS[(rng as usize) % SAFE_DIGITS.len()];

    format!("{}{}{}", word, d1 as char, d2 as char)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_room_code() {
        let code = generate_room_code();
        assert_eq!(code.len(), 6);
        assert!(code[..4].chars().all(|c| c.is_ascii_uppercase()));
        assert!(code[4..].chars().all(|c| "23456789".contains(c)));
    }
}
